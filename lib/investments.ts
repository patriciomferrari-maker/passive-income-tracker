/**
 * Investment Cashflow Generator
 * Handles ONs (Corporate Bonds) and Treasuries
 */

import { prisma } from './prisma';
import { addMonths, daysBetweenExact, formatDateKey, calculateXIRR } from './financial';

interface InvestmentData {
    id: string;
    ticker: string;
    type: string;
    couponRate: number;
    frequency: number;
    maturityDate: Date;
    emissionDate?: Date;
    amortization: string;
}

interface TransactionData {
    date: Date;
    quantity: number;
    price: number;
    commission: number;
    totalAmount: number;
}

interface CashflowRow {
    investmentId: string;
    date: Date;
    amount: number;
    currency: string;
    type: string;
    description: string;
    capitalResidual?: number; // Total nominals * residual factor
}

/**
 * Generates cashflow projections for an investment
 */
export async function generateInvestmentCashflow(investmentId: string): Promise<CashflowRow[]> {
    // Fetch investment
    const investment = await prisma.investment.findUnique({
        where: { id: investmentId },
        include: {
            transactions: { orderBy: { date: 'asc' } },
            amortizationSchedules: { orderBy: { paymentDate: 'asc' } }
        }
    });

    if (!investment) throw new Error('Investment not found');
    const type = investment.type;

    // Skip generation for ETFs or Stocks (they don't have predictable cashflows)
    if (['ETF', 'STOCK', 'CEDEAR', 'EQUITY', 'FCI'].includes(type || '')) {
        return [];
    }

    if (!investment.maturityDate || !investment.frequency) {
        throw new Error('Investment missing required fields');
    }

    const maturityDate = new Date(investment.maturityDate);
    const emissionDate = investment.emissionDate ? new Date(investment.emissionDate) : null;
    const freqMonths = investment.frequency;
    const annualRate = investment.couponRate || 0;
    const amortizationType = investment.amortization || 'BULLET';


    // 1. Generate Full Schedule (Issuer View)
    // We need to know the full schedule to calculate residual factors correctly
    const scheduleDates: Date[] = [];
    let currentDate = new Date(maturityDate);

    // Work backwards from maturity to emission (or a reasonable past date)
    // If emission date is missing, we'll assume a standard 2-year history or stop at earliest purchase
    const stopDate = emissionDate || addMonths(maturityDate, -24);

    let guard = 0;
    while (guard < 500) {
        scheduleDates.unshift(new Date(currentDate));
        const prevDate = addMonths(currentDate, -freqMonths);
        if (prevDate < stopDate && !emissionDate) break; // If no emission date, stop reasonably
        if (emissionDate && prevDate < emissionDate) break; // Stop at emission
        currentDate = prevDate;
        guard++;
    }

    // 2. Calculate Factors per Period
    // We calculate what % of Face Value is amortized and what is the residual for interest
    const periodFactors = scheduleDates.map(date => ({
        date,
        amortizationFactor: 0,
        residualFactor: 1.0 // Starts at 1.0, updated below
    }));

    const totalPeriods = periodFactors.length;

    // Calculate Amortization Factors
    if (amortizationType === 'BULLET') {
        // 100% at maturity
        periodFactors[totalPeriods - 1].amortizationFactor = 1.0;
    } else if (amortizationType === 'LINEAR') {
        // Equal parts
        const part = 1.0 / totalPeriods;
        periodFactors.forEach(p => p.amortizationFactor = part);
    } else if (amortizationType === 'PERSONALIZADA') {
        // Use amortizationSchedules
        // Map each schedule to the closest period date in the same month
        investment.amortizationSchedules.forEach(sch => {
            const schDate = new Date(sch.paymentDate);
            const schYear = schDate.getUTCFullYear();
            const schMonth = schDate.getUTCMonth();

            // Find period in the same year and month (allowing for day differences due to addMonths)
            const period = periodFactors.find(p => {
                const pYear = p.date.getUTCFullYear();
                const pMonth = p.date.getUTCMonth();
                return pYear === schYear && pMonth === schMonth;
            });

            if (period) {
                period.amortizationFactor = sch.percentage; // Percentage is already stored as decimal (0.65 = 65%)
            } else {
                console.warn(`No matching period found for amortization schedule: ${schDate.toISOString().split('T')[0]}`);
            }
        });

        // Safety check: if no schedules found, default to bullet to avoid infinite loop or 0 payments
        if (investment.amortizationSchedules.length === 0) {
            periodFactors[totalPeriods - 1].amortizationFactor = 1.0;
        }
    }

    // Calculate Residual Factors (Iterative)
    let currentResidual = 1.0;
    // Interest for period i is based on Residual at i-1 (or 1.0 for first period)
    // Amortization at period i reduces Residual for i+1

    // We need to store the residual used for INTEREST calculation for each period
    const interestResiduals = new Map<string, number>();

    for (let i = 0; i < periodFactors.length; i++) {
        const p = periodFactors[i];

        // Interest is paid on the residual BEFORE this period's amortization
        interestResiduals.set(p.date.toISOString(), currentResidual);

        // Update residual for next period
        currentResidual = Math.max(0, currentResidual - p.amortizationFactor);
    }

    // 3. Generate User Cashflows
    // Filter schedule for dates relevant to user (after first purchase)

    const allCashflows: CashflowRow[] = [];

    for (let i = 0; i < periodFactors.length; i++) {
        const period = periodFactors[i];
        const payDate = period.date;

        // Calculate User Holdings on this date
        // Sum of all BUY transactions before or on this date
        const userHoldings = investment.transactions.reduce((sum, tx) => {
            if (new Date(tx.date) <= payDate && tx.type === 'BUY') {
                return sum + tx.quantity;
            }
            return sum;
        }, 0);

        if (userHoldings <= 0) continue;

        const dateKey = formatDateKey(payDate);
        const residualForInterest = interestResiduals.get(payDate.toISOString()) || 0;

        // Calculate Interest
        // Interest = Holdings * ResidualFactor * Rate * (Days / 365)
        // Determine days since last payment (or emission)
        let prevDate: Date;
        if (i === 0) {
            prevDate = emissionDate || addMonths(payDate, -freqMonths);
        } else {
            prevDate = periodFactors[i - 1].date;
        }

        const days = Math.max(0, daysBetweenExact(prevDate, payDate));
        const interestAmount = userHoldings * residualForInterest * annualRate * (days / 365);

        if (interestAmount > 0) {
            allCashflows.push({
                investmentId,
                date: payDate,
                amount: interestAmount,
                currency: investment.currency,
                type: 'INTEREST',
                description: `Interés (${(residualForInterest * 100).toFixed(0)}% VR)`,
                capitalResidual: userHoldings * (residualForInterest - period.amortizationFactor) // Residual AFTER this payment
            });
        }

        // Calculate Amortization
        const amortAmount = userHoldings * period.amortizationFactor;

        if (amortAmount > 0) {
            allCashflows.push({
                investmentId,
                date: payDate,
                amount: amortAmount,
                currency: investment.currency,
                type: 'AMORTIZATION',
                description: `Amortización (${(period.amortizationFactor * 100).toFixed(2)}%)`,
                capitalResidual: userHoldings * (residualForInterest - period.amortizationFactor)
            });
        }
    }

    return allCashflows;
}

/**
 * Saves generated cashflows to the database
 */
export async function saveInvestmentCashflows(cashflows: CashflowRow[]) {
    if (cashflows.length === 0) return;

    const investmentId = cashflows[0].investmentId;

    // Delete existing projected cashflows for this investment
    await prisma.cashflow.deleteMany({
        where: {
            investmentId,
            status: 'PROJECTED'
        }
    });

    // Bulk insert new cashflows
    await prisma.$transaction(
        cashflows.map(cf => prisma.cashflow.create({
            data: {
                investmentId: cf.investmentId,
                date: cf.date,
                amount: cf.amount,
                currency: cf.currency,
                type: cf.type,
                status: 'PROJECTED',
                description: cf.description,
                capitalResidual: cf.capitalResidual,
            }
        }))
    );
}
