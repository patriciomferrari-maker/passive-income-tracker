import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { startOfMonth, subMonths, format, endOfMonth, addMonths, isBefore, isAfter, startOfDay, differenceInMonths, differenceInDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { calculateFIFO, FIFOResult, FIFOTransaction } from '@/app/lib/fifo';
import { getLatestPrices } from '@/app/lib/market-data';

// XIRR Implementation (Newton-Raphson)
function calculateXIRR(values: number[], dates: Date[], guess = 0.1): number {
    if (values.length === 0 || values.length !== dates.length) return 0;

    const xnpv = (rate: number, val: number[], dat: Date[]) => {
        let sum = 0;
        const t0 = dat[0];
        for (let i = 0; i < val.length; i++) {
            const dt = differenceInDays(dat[i], t0) / 365.0;
            sum += val[i] / Math.pow(1 + rate, dt);
        }
        return sum;
    };

    const xnpvPrime = (rate: number, val: number[], dat: Date[]) => {
        let sum = 0;
        const t0 = dat[0];
        for (let i = 0; i < val.length; i++) {
            const dt = differenceInDays(dat[i], t0) / 365.0;
            sum += -dt * val[i] / Math.pow(1 + rate, dt + 1);
        }
        return sum;
    };

    let rate = guess;
    for (let i = 0; i < 100; i++) {
        const v = xnpv(rate, values, dates);
        const d = xnpvPrime(rate, values, dates);
        if (Math.abs(d) < 1e-6) break;
        const newRate = rate - v / d;
        if (Math.abs(newRate - rate) < 1e-6) return newRate;
        rate = newRate;
    }

    return isNaN(rate) ? 0 : rate;
}

export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const userId = await getUserId();
        const settings = await prisma.appSettings.findUnique({ where: { userId } });
        const enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

        const today = new Date();

        // 0. Latest Valid IPC Date (History Limit)
        const lastIPC = await prisma.economicIndicator.findFirst({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' }
        });
        // If no IPC, use today. If IPC exists, usage restricts history to that month.
        const maxValidDate = lastIPC ? endOfMonth(lastIPC.date) : endOfMonth(today);

        // History Range: Last 12 months ending at maxValidDate
        const historyStart = subMonths(startOfMonth(maxValidDate), 11);
        const historyEnd = maxValidDate;

        // Projection Start: Month strictly after maxValidDate
        // Example: If IPC is Oct, History ends Oct. Projection starts Nov.
        const projectionStart = startOfMonth(addMonths(maxValidDate, 1));
        const projectionEnd = endOfMonth(addMonths(projectionStart, 11)); // 12 months projection

        // 1. Fetch History Cashflows (Interest Only, No Debt)
        const historyCashflows = await prisma.cashflow.findMany({
            where: {
                investment: { userId },
                date: { gte: historyStart, lte: historyEnd },
                type: 'INTEREST',
            },
            include: { investment: { select: { type: true } } }
        });

        // 2. Fetch Rental Income (History)
        const rentalCashflows = await prisma.rentalCashflow.findMany({
            where: {
                contract: { property: { userId } },
                date: { gte: historyStart, lte: historyEnd }
            },
            select: { date: true, amountUSD: true }
        });

        // --- NEW METRICS CALCULATIONS (V3.2) ---

        // A. Total Investment & TIR Data
        const investments = await prisma.investment.findMany({
            where: {
                userId
                // Removed type filter to include CEDEAR, EQUITY, etc.
            },
            include: {
                transactions: true,
                cashflows: {
                    where: { date: { lte: today } } // Include ALL past flows (Projected/Paid)
                }
            }
        });

        let totalInvestedON = 0;
        let totalInvestedTreasury = 0;
        let xirrValues: number[] = [];
        let xirrDates: Date[] = [];

        investments.forEach(inv => {
            let units = 0;
            let lastPrice = 0; // Fallback for market value

            // Process Transactions
            inv.transactions.sort((a, b) => a.date.getTime() - b.date.getTime()).forEach(tx => {
                const qty = Math.abs(tx.quantity);
                const price = Math.abs(tx.price);

                if (tx.type === 'BUY') {
                    units += qty;
                    lastPrice = price; // Update last known price
                    xirrValues.push(-Math.abs(tx.totalAmount)); // Outflow
                    xirrDates.push(tx.date);
                } else if (tx.type === 'SELL') {
                    units -= qty;
                    xirrValues.push(Math.abs(tx.totalAmount)); // Inflow
                    xirrDates.push(tx.date);
                }
            });

            // Process Flows
            inv.cashflows.forEach(cf => {
                xirrValues.push(cf.amount);
                xirrDates.push(cf.date);
            });

            // Calculate Terminal Value (Current Value)
            // Units * Last Known Price
            const currentValue = Math.max(0, units * lastPrice);

            // Add to Stats
            if (inv.type === 'ON') totalInvestedON += currentValue;
            else if (inv.type === 'TREASURY') totalInvestedTreasury += currentValue;

            // Add Terminal Value to XIRR (as if we sold everything today)
            // This is crucial: it represents the "unrealized" return
            if (currentValue > 0) {
                xirrValues.push(currentValue);
                xirrDates.push(today);
            }
        });



        const totalInvested = investments.reduce((sum, inv) => {
            // Calculate invested capital for ALL investments (Cost Basis)
            // Simple sum of Buys
            const invested = inv.transactions
                .filter(tx => tx.type === 'BUY')
                .reduce((s, tx) => s + Math.abs(tx.totalAmount), 0);
            return sum + invested;
        }, 0);

        // --- P&L CALCULATION (Realized & Unrealized) ---
        // 1. Get Prices
        const tickers = [...new Set(investments.map(i => i.ticker).filter(t => t))];
        const recentPrices = await getLatestPrices(tickers);
        const pricesMap = new Map<string, number>(recentPrices.map(p => [p.ticker, p.price]));

        // 2. Calculate FIFO
        let totalRealizedGL = 0;
        let totalUnrealizedGL = 0;
        const portfolioMap = new Map<string, number>();

        investments.forEach(inv => {
            const currentPrice = pricesMap.get(inv.ticker) || 0;
            // Cast transactions to match FIFOTransaction type
            const fifoTransactions: FIFOTransaction[] = inv.transactions.map(tx => ({
                date: tx.date,
                type: tx.type as 'BUY' | 'SELL',
                quantity: tx.quantity,
                price: tx.price,
                currency: tx.currency,
                commission: tx.commission
            })).filter(tx => tx.type === 'BUY' || tx.type === 'SELL');

            const result = calculateFIFO(fifoTransactions, inv.ticker);

            // Realized Gain from closed positions
            totalRealizedGL += result.totalGainAbs;

            // Unrealized Gain from open positions (Market Value - Cost Basis)
            const totalQty = result.openPositions.reduce((sum, pos) => sum + pos.quantity, 0);
            const marketValue = totalQty * currentPrice;

            if (marketValue > 1) { // Filter out negligible amounts
                const type = inv.type || 'OTRO';
                portfolioMap.set(type, (portfolioMap.get(type) || 0) + marketValue);
            }

            const unrealized = result.openPositions.reduce((sum, pos) => {
                return sum + ((currentPrice - pos.buyPrice) * pos.quantity);
            }, 0);
            totalUnrealizedGL += unrealized;
        });

        // --- BANK COMPOSITION ---
        const bankOperations = await prisma.bankOperation.findMany({
            where: { userId }
        });

        const bankCompositionMap = new Map<string, number>();
        bankOperations.filter(op => op.currency === 'USD').forEach(op => {
            const type = op.type === 'PLAZO_FIJO' ? 'Plazo Fijo' :
                op.type === 'FCI' ? 'FCI' :
                    op.type === 'CAJA_AHORRO' ? 'Caja Ahorro' : 'Otro';
            const current = bankCompositionMap.get(type) || 0;
            bankCompositionMap.set(type, current + op.amount);
        });

        // Merge Bank Composition into Portfolio Distribution
        const portfolioDistribution = [
            ...Array.from(portfolioMap.entries()).map(([name, value]) => ({ name, value })),
            ...Array.from(bankCompositionMap.entries()).map(([name, value]) => ({ name, value }))
        ].sort((a, b) => b.value - a.value);



        const bankComposition = Array.from(bankCompositionMap.entries()).map(([name, value]) => ({
            name, value, fill: '#10b981' // Standard color, can randomize in UI
        }));

        // Calculate TIR
        let tir = 0;
        if (xirrValues.length > 0) {
            try {
                const combined = xirrValues.map((v, i) => ({ v, d: xirrDates[i] }));
                combined.sort((a, b) => a.d.getTime() - b.d.getTime());

                const hasNeg = combined.some(c => c.v < 0);
                const hasPos = combined.some(c => c.v > 0);

                if (hasNeg && hasPos) {
                    tir = calculateXIRR(combined.map(c => c.v), combined.map(c => c.d));
                }
            } catch (e) {
                console.error("Error calculating XIRR:", e);
                tir = 0;
            }
        }

        // B. Next Events
        const nextInterestON = await prisma.cashflow.findFirst({
            where: { investment: { userId, type: 'ON' }, date: { gt: today }, type: 'INTEREST' },
            orderBy: { date: 'asc' },
            include: { investment: { select: { name: true } } }
        });

        const nextInterestTreasury = await prisma.cashflow.findFirst({
            where: { investment: { userId, type: 'TREASURY' }, date: { gt: today }, type: 'INTEREST' },
            orderBy: { date: 'asc' },
            include: { investment: { select: { name: true } } }
        });

        const contracts = await prisma.contract.findMany({
            where: { property: { userId } },
            select: { startDate: true, adjustmentFrequency: true, durationMonths: true, property: { select: { name: true } }, adjustmentType: true }
        });

        let nextRentalAdjustment: { date: string; property: string; monthsTo: number } | null = null;
        let nextContractExpiration: { date: string; property: string; monthsTo: number } | null = null;
        let minDiffAdj = Infinity;
        let minDiffExp = Infinity;

        contracts.forEach(c => {
            if (c.adjustmentType !== 'NONE') {
                let nextAdjDate = new Date(c.startDate);
                while (isBefore(nextAdjDate, today) || nextAdjDate.getTime() === today.getTime()) {
                    nextAdjDate = addMonths(nextAdjDate, c.adjustmentFrequency);
                }
                const diffAdj = nextAdjDate.getTime() - today.getTime();
                if (diffAdj < minDiffAdj) {
                    minDiffAdj = diffAdj;
                    nextRentalAdjustment = { date: nextAdjDate.toISOString(), property: c.property.name, monthsTo: differenceInMonths(nextAdjDate, today) };
                }
            }
            const expDate = addMonths(new Date(c.startDate), c.durationMonths);
            if (isAfter(expDate, today)) {
                const diffExp = expDate.getTime() - today.getTime();
                if (diffExp < minDiffExp) {
                    minDiffExp = diffExp;
                    nextContractExpiration = { date: expDate.toISOString(), property: c.property.name, monthsTo: differenceInMonths(expDate, today) };
                }
            }
        });

        // C. Debt Details
        const debts = await prisma.debt.findMany({
            where: { userId },
            include: { payments: true }
        });
        let totalDebtPending = 0;
        const debtDetails = debts.map(d => {
            let total = d.initialAmount;
            let paid = 0;
            d.payments.forEach(p => { if (p.type === 'INCREASE') total += p.amount; else if (p.type === 'PAYMENT') paid += p.amount; });
            const pending = Math.max(0, total - paid);
            if (pending > 1) totalDebtPending += pending;
            return { name: d.debtorName, paid, pending, total, currency: d.currency };
        }).filter(d => d.pending > 1);

        // D. Bank Data (Already fetched above but need for logic)
        // const bankOperations = ... (fetched above)

        // 1. Total Bank USD
        const totalBankUSD = bankOperations
            .filter(op => op.currency === 'USD')
            .reduce((sum, op) => sum + op.amount, 0);

        // 2. Next Maturity PF
        const pfs = bankOperations.filter(op => op.type === 'PLAZO_FIJO' && op.startDate);

        // Helper: Calculate Interest
        const getInterest = (amount: number, tna: number, days: number) => {
            return amount * (tna / 100) * (days / 365);
        };

        const upcomingPFs = pfs.map(pf => {
            const duration = pf.durationDays || 30; // Default to 30 if missing
            const start = new Date(pf.startDate!);
            const end = new Date(start);
            end.setDate(start.getDate() + duration);
            // Reset time to ensure correct day diff
            const nowDay = startOfDay(today);
            const endDay = startOfDay(end);
            const daysLeft = differenceInDays(endDay, nowDay);

            const interest = getInterest(pf.amount, pf.tna || 0, duration);

            return { ...pf, endDate: end, daysLeft, interest };
        }).filter(pf => pf.daysLeft >= -1).sort((a, b) => a.daysLeft - b.daysLeft);

        const nextMaturitiesPF = upcomingPFs.slice(0, 3).map(pf => ({
            daysLeft: pf.daysLeft,
            date: pf.endDate.toISOString(),
            amount: pf.amount + pf.interest, // Total (Capital + Interest)
            alias: pf.alias
        }));

        // --- E. INTEGRATE PF INTEREST INTO CHARTS ---
        // We consider PF Interest as "Income" when it matures (endDate).

        // 1. Map all PFs (past and future)
        const allPFMaturities = pfs.map(pf => {
            const start = new Date(pf.startDate!);
            const end = new Date(start);
            end.setDate(start.getDate() + (pf.durationDays || 0));
            const interest = getInterest(pf.amount, pf.tna || 0, pf.durationDays || 0);
            return { date: end, interest };
        });

        // --- HISTORY CHART DATA (Strictly bounded by IPC) ---
        const monthlyData = new Map<string, { ON: number; Treasury: number; Rentals: number; Bank: number }>();
        // Fill Map from historyStart to historyEnd
        let iterDate = startOfMonth(historyStart);
        while (isBefore(iterDate, historyEnd) || iterDate.getTime() === startOfMonth(historyEnd).getTime()) {
            const key = format(iterDate, 'yyyy-MM');
            monthlyData.set(key, { ON: 0, Treasury: 0, Rentals: 0, Bank: 0 });
            iterDate = addMonths(iterDate, 1);
        }

        historyCashflows.forEach(cf => {
            const key = format(cf.date, 'yyyy-MM');
            if (monthlyData.has(key)) {
                const amount = cf.amount;
                const type = cf.investment.type === 'ON' ? 'ON' : 'Treasury';
                monthlyData.get(key)![type] += amount;
            }
        });

        rentalCashflows.forEach(cf => {
            const key = format(cf.date, 'yyyy-MM');
            if (monthlyData.has(key)) {
                monthlyData.get(key)!.Rentals += (cf.amountUSD || 0);
            }
        });

        // Integrate PF Interest into History
        allPFMaturities.forEach(pf => {
            const key = format(pf.date, 'yyyy-MM');
            if (monthlyData.has(key)) {
                monthlyData.get(key)!.Bank += pf.interest;
            }
        });

        const history = Array.from(monthlyData.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, values]) => {
                const [year, month] = key.split('-');
                return {
                    month: format(new Date(parseInt(year), parseInt(month) - 1), 'MMM', { locale: es }),
                    fullDate: key,
                    total: values.ON + values.Treasury + values.Rentals + values.Bank,
                    ...values
                };
            });

        // Composition (Last valid month)
        let composition: any[] = [];
        let totalMonthlyIncome = 0;
        if (history.length > 0) {
            const lastMonth = history[history.length - 1];
            totalMonthlyIncome = lastMonth.total;
            composition = [
                { name: 'Obligaciones Negociables', value: lastMonth.ON, fill: '#3b82f6' },
                { name: 'Treasuries', value: lastMonth.Treasury, fill: '#8b5cf6' },
                { name: 'Alquileres', value: lastMonth.Rentals, fill: '#10b981' },
                { name: 'Intereses Banco', value: lastMonth.Bank, fill: '#f59e0b' }
            ].filter(item => item.value > 0);
        }

        // --- PROJECTION CART DATA (Gapless) ---
        const projectedCashflows = await prisma.cashflow.findMany({
            where: {
                investment: { userId },
                date: { gte: projectionStart, lte: projectionEnd }
            },
            include: { investment: { select: { type: true } } }
        });

        const projectedMap = new Map<string, { Interest: number; Capital: number; BankInterest: number }>();
        // Initialize projection months
        iterDate = startOfMonth(projectionStart);
        while (isBefore(iterDate, projectionEnd) || iterDate.getTime() === startOfMonth(projectionEnd).getTime()) {
            const key = format(iterDate, 'yyyy-MM');
            projectedMap.set(key, { Interest: 0, Capital: 0, BankInterest: 0 });
            iterDate = addMonths(iterDate, 1);
        }

        projectedCashflows.forEach(cf => {
            const key = format(cf.date, 'yyyy-MM');
            if (projectedMap.has(key)) {
                if (cf.type === 'AMORTIZATION') {
                    projectedMap.get(key)!.Capital += cf.amount;
                } else {
                    projectedMap.get(key)!.Interest += cf.amount;
                }
            }
        });

        // Integrate PF Interest into Projection
        allPFMaturities.forEach(pf => {
            const key = format(pf.date, 'yyyy-MM');
            if (projectedMap.has(key)) {
                projectedMap.get(key)!.BankInterest += pf.interest;
            }
        });

        const projected = Array.from(projectedMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, values]) => {
                const [year, month] = key.split('-');
                return {
                    month: format(new Date(parseInt(year), parseInt(month) - 1), 'MMM', { locale: es }),
                    total: values.Interest + values.Capital + values.BankInterest,
                    ...values
                };
            });


        return NextResponse.json({
            summary: {
                totalInvested,
                totalDebtPending,
                tir,
                nextInterestON: nextInterestON ? { date: nextInterestON.date, amount: nextInterestON.amount, name: nextInterestON.investment.name } : null,
                nextInterestTreasury: nextInterestTreasury ? { date: nextInterestTreasury.date, amount: nextInterestTreasury.amount, name: nextInterestTreasury.investment.name } : null,
                nextRentalAdjustment,
                nextContractExpiration,
                totalMonthlyIncome,
                totalBankUSD,
                nextMaturitiesPF
            },
            pnl: {
                realized: totalRealizedGL,
                unrealized: totalUnrealizedGL
            },
            bankComposition,
            portfolioDistribution,
            history,
            composition,
            projected,
            debtDetails,
            enabledSections,
            debug: { userId, raw: settings?.enabledSections }
        });

    } catch (error) {
        console.error('Error fetching global dashboard data:', error);
        return unauthorized();
    }
}
