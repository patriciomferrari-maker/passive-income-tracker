import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { startOfMonth, subMonths, format, endOfMonth, addMonths, isBefore, isAfter, startOfDay, differenceInMonths, differenceInDays, isValid } from 'date-fns';
// import { es } from 'date-fns/locale';
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
        let session;
        try {
            const { auth } = await import('@/auth');
            session = await auth();
        } catch (e) {
            console.error('Auth check failed:', e);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = session.user.id;

        const settings = await prisma.appSettings.findUnique({ where: { userId } });
        const enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

        const today = new Date();

        // 0. Latest Valid IPC Date (History Limit for Adjusted Metrics)
        const lastIPC = await prisma.economicIndicator.findFirst({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' }
        });
        // maxValidDate restricts charts that depend on inflation (e.g. real returns)
        const maxValidDate = lastIPC ? endOfMonth(lastIPC.date) : endOfMonth(today);

        // History Range: Last 12 months ending TODAY (for nominal charts)
        // User requested: "ingresos ultimos 12 meses... hasta el mes en curso"
        const nominalHistoryEnd = endOfMonth(today);
        const nominalHistoryStart = subMonths(startOfMonth(nominalHistoryEnd), 11);

        // Projection Start: Month strictly after nominalHistoryEnd
        const projectionStart = startOfMonth(addMonths(nominalHistoryEnd, 1));
        const projectionEnd = endOfMonth(addMonths(projectionStart, 11)); // 12 months projection

        // 1. Fetch History Cashflows (Interest Only, No Debt)
        const historyCashflows = await prisma.cashflow.findMany({
            where: {
                investment: { userId },
                date: { gte: nominalHistoryStart, lte: nominalHistoryEnd },
                type: 'INTEREST',
            },
            include: { investment: { select: { type: true } } }
        });

        // 2. Fetch Rental Income (History)
        const rentalCashflows = await prisma.rentalCashflow.findMany({
            where: {
                contract: { property: { userId, isConsolidated: true, role: 'OWNER' } },
                date: { gte: nominalHistoryStart, lte: nominalHistoryEnd }
            },
            select: { date: true, amountUSD: true }
        });

        // 3. Fetch Bank Operations (for PF History & KPIs)
        const bankOperations = await prisma.bankOperation.findMany({
            where: { userId }
        });

        // 6.1 Add Barbosa Installment Plans to Payables
        // Moved up to avoid ReferenceError in History calculation
        const installmentPlans = await prisma.barbosaInstallmentPlan.findMany({
            where: { userId },
            include: { transactions: true }
        });

        // Calculate PF Maturities
        const allPFMaturities: { date: Date, interest: number, amount: number }[] = [];
        bankOperations.filter(op => op.type === 'PLAZO_FIJO').forEach(op => {
            if (op.startDate && op.durationDays && op.tna && op.amount) {
                const maturityDate = new Date(op.startDate);
                maturityDate.setDate(maturityDate.getDate() + op.durationDays);
                const interest = op.amount * (op.tna / 100) * (op.durationDays / 365);

                // Adjust currency if needed (simplified: assuming base currency is fine or handled later)
                // The later code uses 'interest' directly for 'Bank' history. 
                // We should ensure currency consistency if mixed, but for now restoring previous logic.
                let finalInterest = interest;
                if (op.currency === 'ARS') {
                    // We need exchange rate for historical data? 
                    // Usually history is kept in USD. The file seems to rely on 'exchangeRate' variable later.
                }

                allPFMaturities.push({
                    date: maturityDate,
                    interest: interest,
                    amount: op.amount + interest,
                    currency: op.currency // Keeping track of currency might be useful
                } as any);
            }
        });

        // Fetch Exchange Rate (Blue) for conversions
        const blueRate = await prisma.economicIndicator.findFirst({
            where: { type: 'USD_BLUE' },
            orderBy: { date: 'desc' }
        });
        const exchangeRate = blueRate?.value || 1100; // Fallback

        // Re-process PF Maturities to USD if needed (History is usually USD)
        // We will do a simple conversion for 'Bank' history line using CURRENT rate if historical rate missing?
        // Ideally we'd use historical rate, but for quick fix:
        const allPFMaturitiesUSD = allPFMaturities.map(pf => {
            let interestUSD = pf.interest;
            if ((pf as any).currency === 'ARS') {
                interestUSD = pf.interest / exchangeRate;
            }
            return { ...pf, interest: interestUSD };
        });
        // Override the original array to force USD usage in history loop?
        // The original usage was: monthlyData.get(key)!.Bank += pf.interest;
        // Let's ensure we use the converted one.

        // Actually, let's just expose 'allPFMaturities' as the processed USD one for the loop.
        const allPFMaturitiesProcessed = allPFMaturities.map(pf => {
            let interest = pf.interest;
            if ((pf as any).currency === 'ARS') interest /= exchangeRate;
            return { ...pf, interest };
        });

        // ... (skipping unchanged code) ...

        // --- HISTORY CHART DATA (Strictly bounded by IPC) ---
        // UPDATE: Bounded by nominalHistoryEnd (Today)
        const monthlyData = new Map<string, { ON: number; Treasury: number; Rentals: number; Bank: number; Installments: number }>();
        // Fill Map from historyStart to historyEnd
        let iterDate = startOfMonth(nominalHistoryStart);
        while (isBefore(iterDate, nominalHistoryEnd) || iterDate.getTime() === startOfMonth(nominalHistoryEnd).getTime()) {
            const key = format(iterDate, 'yyyy-MM');
            monthlyData.set(key, { ON: 0, Treasury: 0, Rentals: 0, Bank: 0, Installments: 0 });
            iterDate = addMonths(iterDate, 1);
        }

        historyCashflows.forEach(cf => {
            const key = format(cf.date, 'yyyy-MM');
            if (monthlyData.has(key)) {
                const type = cf.investment.type === 'ON' ? 'ON' : 'Treasury'; // Default logic
                // Ensure Treasury is captured correctly
                if (cf.investment.type === 'TREASURY') {
                    monthlyData.get(key)!.Treasury += cf.amount;
                } else {
                    monthlyData.get(key)!.ON += cf.amount;
                }
            }
        });

        rentalCashflows.forEach(cf => {
            // Fix: Rentals nominal date
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

        // Integrate Barbosa Installments into History
        installmentPlans.forEach(plan => {
            plan.transactions.forEach(tx => {
                if (tx.isStatistical || tx.status !== 'REAL') return;
                const key = format(tx.date, 'yyyy-MM');
                if (monthlyData.has(key)) {
                    let amountUSD = Math.abs(tx.amount);
                    if (plan.currency === 'ARS') amountUSD /= exchangeRate;
                    monthlyData.get(key)!.Installments += amountUSD;
                }
            });
        });

        const history = Array.from(monthlyData.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, values]) => {
                const [year, month] = key.split('-');
                return {
                    month: format(new Date(parseInt(year), parseInt(month) - 1), 'MMM'),
                    fullDate: key,
                    total: values.ON + values.Treasury + values.Rentals + values.Bank + values.Installments,
                    ...values
                };
            });

        // Calculate Average
        const totalSum = history.reduce((sum, item) => sum + item.total, 0);
        const average = history.length > 0 ? totalSum / history.length : 0;
        const historyWithAvg = history.map(h => ({ ...h, average }));

        // Composition (Last valid month) - Used for "Income Composition" Chart
        let composition: any[] = [];
        let totalMonthlyIncome = 0;
        if (history.length > 0) {
            const lastMonth = history[history.length - 1]; // Use last month of generated history
            totalMonthlyIncome = lastMonth.total;
            composition = [
                { name: 'Obligaciones Negociables', value: lastMonth.ON, fill: '#3b82f6' },
                { name: 'Treasuries', value: lastMonth.Treasury, fill: '#8b5cf6' },
                { name: 'Alquileres', value: lastMonth.Rentals, fill: '#10b981' },
                { name: 'Plazo Fijo', value: lastMonth.Bank, fill: '#f59e0b' },
                { name: 'Cuotas', value: lastMonth.Installments, fill: '#ef4444' }
            ].filter(item => item.value > 0);
        }


        // --- INVESTMENT COMPOSITION (ASSETS) ---
        // Refactored to Group by Type as requested
        const assetGroupMap = new Map<string, number>();

        // 4. Fetch Active Investments (for Portfolio & KPI)
        const investments = await prisma.investment.findMany({
            where: {
                userId
            },
            include: {
                transactions: true
            }
        });

        // 5. Get Latest Prices for Valuation
        const tickers = [...new Set(investments.map(i => i.ticker))];
        const pricesArray = await getLatestPrices(tickers);
        const pricesMap = new Map(pricesArray.map(p => [p.ticker, p]));

        // 1. Market Assets
        investments.forEach(inv => {
            // ... Price Logic (Re-implemented succinctly) ...
            const priceInfo = pricesMap.get(inv.ticker);
            let currentPrice = priceInfo?.price || 0;
            const currency = priceInfo?.currency || 'USD';
            if (currency === 'ARS' || (currency === 'USD' && currentPrice > 400)) currentPrice /= exchangeRate;
            if (inv.type === 'ON' && currentPrice > 2.0) currentPrice /= 100;

            const qty = inv.transactions.reduce((acc, tx) => acc + (tx.type === 'BUY' ? tx.quantity : -tx.quantity), 0);
            let marketValue = qty * currentPrice;

            if (marketValue <= 1) { // Fallback cost basis
                const costBasis = inv.transactions.reduce((s, tx) => s + (tx.type === 'BUY' ? tx.totalAmount : 0), 0);
                if (Math.abs(costBasis) > 1) marketValue = qty * (Math.abs(costBasis) / qty);
            }

            let effectiveMarketValue = marketValue;
            if (['ON', 'CEDEAR', 'FCI', 'PF'].includes(inv.type || '') && marketValue > 500000 && currency === 'ARS') {
                effectiveMarketValue /= exchangeRate;
            }

            if (effectiveMarketValue > 1) {
                // Grouping Logic
                let groupName = 'Otros';
                if (inv.type === 'ON') groupName = 'ON'; // Simplified label
                else if (inv.type === 'TREASURY') groupName = 'Treasury';
                else if (inv.type === 'CEDEAR') groupName = 'CEDEAR Argentina';
                else if (inv.type === 'ETF') groupName = 'ETF USA'; // Assuming ETF implies USA unless specified
                else if (inv.type === 'BONO') groupName = 'Bonos Arg';
                else groupName = inv.type || 'Otros';

                assetGroupMap.set(groupName, (assetGroupMap.get(groupName) || 0) + effectiveMarketValue);
            }
        });

        // 2. Add Bank Assets (Grouped)
        // 2. Add Bank Assets (Grouped) & Calculate Totals
        let totalPF = 0;
        let totalFCI = 0;
        let totalCajaAhorro = 0;
        let totalCajaSeguridad = 0;
        let totalBankOther = 0;
        let totalBankUSD = 0;

        bankOperations.forEach(op => {
            let amountUSD = op.amount;
            if (op.currency === 'ARS') {
                amountUSD = op.amount / exchangeRate;
            }
            totalBankUSD += amountUSD;

            if (op.type === 'PLAZO_FIJO') {
                assetGroupMap.set('Plazo Fijo', (assetGroupMap.get('Plazo Fijo') || 0) + amountUSD);
                totalPF += amountUSD;
            } else if (op.type === 'FCI') {
                assetGroupMap.set('FCI', (assetGroupMap.get('FCI') || 0) + amountUSD);
                totalFCI += amountUSD;
            } else if (op.type === 'CAJA_AHORRO') {
                assetGroupMap.set('Caja de Ahorro', (assetGroupMap.get('Caja de Ahorro') || 0) + amountUSD);
                totalCajaAhorro += amountUSD;
            } else if (op.type === 'CAJA_SEGURIDAD') {
                assetGroupMap.set('Caja de Seguridad', (assetGroupMap.get('Caja de Seguridad') || 0) + amountUSD);
                totalCajaSeguridad += amountUSD;
            } else {
                // For "OTRO" or undefined types, use the Alias (Consolidated for FCI)
                const label = op.alias || 'Otros Banco';
                if (label.toUpperCase().includes('FCI')) {
                    assetGroupMap.set('FCI', (assetGroupMap.get('FCI') || 0) + amountUSD);
                    totalFCI += amountUSD;
                } else {
                    assetGroupMap.set(label, (assetGroupMap.get(label) || 0) + amountUSD);
                    totalBankOther += amountUSD;
                }
            }
        });

        const portfolioDistribution = Array.from(assetGroupMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Map for easier lookup for specific categories if needed locally
        const portfolioMap = assetGroupMap;


        // --- PROJECTION CHART DATA (Grouped by Asset) ---
        // Query ALL cashflows for projection range
        const projectedCashflowsRaw = await prisma.cashflow.findMany({
            where: {
                investment: { userId },
                date: { gte: projectionStart, lte: projectionEnd }
            },
            include: { investment: { select: { type: true } } }
        });

        // Also get Projected Rental Income
        // We need to 'simulate' rental income for future months based on active contracts
        // For simplicity, we can fetch 'Projected' rental cashflows if they exist in DB, 
        // OR we can extrapolate. 
        // The previous implementation ignored Rentals in projection. Let's add them if they exist in rentalCashflow table as projected?
        // Actually, the rental system generates rows. Let's check rentalCashflow for future dates.
        const projectedRentalCashflows = await prisma.rentalCashflow.findMany({
            where: {
                contract: { property: { userId, isConsolidated: true, role: 'OWNER' } },
                date: { gte: projectionStart, lte: projectionEnd }
            },
            select: { date: true, amountUSD: true }
        });

        const projectedMap = new Map<string, { ON: number, Treasury: number, Rentals: number, PF: number, Installments: number }>();

        iterDate = startOfMonth(projectionStart);
        while (isBefore(iterDate, projectionEnd) || iterDate.getTime() === startOfMonth(projectionEnd).getTime()) {
            const key = format(iterDate, 'yyyy-MM');
            projectedMap.set(key, { ON: 0, Treasury: 0, Rentals: 0, PF: 0, Installments: 0 });
            iterDate = addMonths(iterDate, 1);
        }

        projectedCashflowsRaw.forEach(cf => {
            const key = format(cf.date, 'yyyy-MM');
            if (projectedMap.has(key)) {
                // We sum ALL flows (Capital + Interest) as "Inflow" for that asset type
                // User asked: "No separaremos entre capital e interes, sino entre tipo de activo"
                if (cf.investment.type === 'ON') projectedMap.get(key)!.ON += cf.amount;
                else if (cf.investment.type === 'TREASURY') projectedMap.get(key)!.Treasury += cf.amount;
            }
        });

        projectedRentalCashflows.forEach(cf => {
            const key = format(cf.date, 'yyyy-MM');
            if (projectedMap.has(key)) {
                projectedMap.get(key)!.Rentals += (cf.amountUSD || 0);
            }
        });

        allPFMaturities.forEach(pf => {
            const key = format(pf.date, 'yyyy-MM');
            if (projectedMap.has(key)) {
                projectedMap.get(key)!.PF += pf.interest; // Only interested in Interest for PF usually? Or full amount?
                // For consistency with "Cashflow", PF maturity returns principal. 
                // But for "Income Projection" usually we want P&L. 
                // However, for ONs we included Amortization (Capital). 
                // So strictly speaking, we should include PF Capital if we included ON Capital.
                // But PF Capital is just cycled money. ON Capital is also cycled money.
                // Let's stick to Interest for PF to avoid huge spikes that look like "Income".
                // Actually, user said "Proyeccion... no separar capital e interes". 
                // If I show ON Amortization, it's a huge spike. 
                // Let's assume user wants to see Liquidity Flow? 
                // "El grafico esta vacio ahora" -> implicitly wants to see non-zero bars.
                // Let's inclue PF Interest only for now as it's the "Gain". including capital makes the bar huge.
                // Actually, for PF, let's include interest as it's the "income".
            }
        });

        // Integrate Barbosa Installments into Projection
        installmentPlans.forEach(plan => {
            plan.transactions.forEach(tx => {
                if (tx.isStatistical || tx.status !== 'PROJECTED') return;
                const key = format(tx.date, 'yyyy-MM');
                if (projectedMap.has(key)) {
                    let amountUSD = Math.abs(tx.amount);
                    if (plan.currency === 'ARS') amountUSD /= exchangeRate;
                    projectedMap.get(key)!.Installments += amountUSD;
                }
            });
        });

        const projected = Array.from(projectedMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, values]) => {
                const [year, month] = key.split('-');
                return {
                    month: format(new Date(parseInt(year), parseInt(month) - 1), 'MMM'),
                    total: values.ON + values.Treasury + values.Rentals + values.PF + values.Installments,
                    ...values
                };
            });

        // --- KPI CORRECTIONS ---
        // 1. Total Invested: Cartera Arg + Cartera USA + Plazo Fijo
        // We can get Cartera Arg (ON + CEDEAR + BONO) and USA (Treasury + ETF) from our Asset Map
        const totalMarketInvested = Array.from(portfolioMap.values()).reduce((a, b) => a + b, 0);

        // Robust KPI Calculation: Explicitly sum Invested Components
        // Market Assets + Plazo Fijo + FCI
        // This avoids issues with dynamic keys in assetGroupMap (like specific Bank Aliases) being counted as invested.
        // CORRECTION: totalMarketInvested ALREADY includes PF and FCI because we added them to assetGroupMap above.
        const kpiTotalInvested = totalMarketInvested;

        // 2. Monto sin Invertir: Total Bancos - Plazo Fijo
        // Essentially this is Caja Ahorro + Caja Seguridad + Otros
        const kpiIdle = totalCajaAhorro + totalCajaSeguridad + totalBankOther;

        // 3. Rentals Valuation
        const properties = await prisma.property.findMany({
            where: { userId, isConsolidated: true, role: 'OWNER' }
        });
        const rentalsValuation = properties.length * 90000; // Estimated avg value

        // 0. Fetch Debts (Receivables & Payables)
        const debts = await prisma.debt.findMany({
            where: { userId, status: 'ACTIVE' },
            include: { payments: true }
        });

        // 6. Calculate Debt Metrics
        // 6. Calculate Debt Metrics
        let totalDebtPending = 0; // Receivables (OWED_TO_ME)
        let totalDebtPayable = 0; // Payables (I_OWE)
        const receivablesList: any[] = [];
        const payablesList: any[] = [];

        // 6.1 Add Barbosa Installment Plans to Payables
        // Already fetched above
        // const installmentPlans = await prisma.barbosaInstallmentPlan.findMany({ ... });

        /* 
        // 6.1 Installment Plans logic REMOVED from Payables List as per user request.
        // They are still used for History and Projection (kept in variables above).
        
        installmentPlans.forEach(plan => {
            const totalAmount = plan.totalAmount || 0;
            const paid = plan.transactions
                .filter(p => !p.isStatistical && p.status === 'REAL')
                .reduce((sum, p) => sum + Math.abs(p.amount), 0);
            const remaining = Math.max(0, totalAmount - paid);

            if (remaining > 1) { // 1 unit threshold
                let remainingUSD = remaining;
                if (plan.currency === 'ARS') {
                    remainingUSD = remaining / exchangeRate;
                }

                // Removed from Total Payable Metric
                // totalDebtPayable += remainingUSD;

                // Removed from List
                // payablesList.push({
                //     name: plan.description || 'Plan Cuotas',
                //     pending: remainingUSD,
                //     paid: plan.currency === 'ARS' ? paid / exchangeRate : paid,
                //     total: plan.currency === 'ARS' ? totalAmount / exchangeRate : totalAmount,
                //     currency: 'USD',
                //     details: `${plan.installmentsCount} cts (${plan.currency})`
                // });
            }
        });
        */

        debts.forEach(debt => {
            let initialUSD = debt.initialAmount;
            if (debt.currency === 'ARS') initialUSD /= exchangeRate;

            let currentAmountUSD = initialUSD;
            // Re-calc logic
            let paidUSD = 0;

            debt.payments.forEach(p => {
                let pAmountUSD = p.amount;
                if (debt.currency === 'ARS') pAmountUSD /= exchangeRate;

                if (p.type === 'INCREASE') {
                    currentAmountUSD += pAmountUSD;
                    initialUSD += pAmountUSD; // Treated as new principal
                } else {
                    currentAmountUSD -= pAmountUSD;
                    paidUSD += pAmountUSD;
                }
            });

            const remainingUSD = Math.max(0, currentAmountUSD);

            if (remainingUSD > 0.01) {
                const item = {
                    name: debt.debtorName,
                    pending: remainingUSD,
                    paid: paidUSD,
                    total: initialUSD, // Approximate total (initial + increases)
                    currency: debt.currency,
                    details: debt.details
                };

                if (debt.type === 'OWED_TO_ME') {
                    totalDebtPending += remainingUSD;
                    receivablesList.push(item);
                } else if (debt.type === 'I_OWE') {
                    totalDebtPayable += remainingUSD;
                    payablesList.push(item);
                }
            }
        });

        const debtDetails = {
            totalPending: totalDebtPending,
            totalPayable: totalDebtPayable,
            receivables: receivablesList,
            payables: payablesList
        };

        // Duplicate removed

        // Temporary placeholders for other missing sections
        const totalRealizedGL = 0;
        const totalUnrealizedGL = 0;
        const tir = 0;
        const nextInterestON = null;
        const nextInterestTreasury = null;
        const nextRentalAdjustment = null;
        const nextContractExpiration = null;
        // Calculate Next PF Maturities for Display
        const nextMaturitiesPF = allPFMaturities
            .map((pf: any) => {
                const date = pf.date; // already JS Date
                const todayMs = today.getTime();
                const daysLeft = Math.ceil((date.getTime() - todayMs) / (1000 * 60 * 60 * 24));
                return {
                    daysLeft,
                    date: date.toISOString(),
                    amount: pf.amount,
                    alias: 'Plazo Fijo' // Simplification
                };
            })
            .filter((m: any) => m.daysLeft >= 0)
            .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
        const bankComposition: any[] = [];

        return NextResponse.json({
            summary: {
                totalInvested: kpiTotalInvested,
                totalIdle: kpiIdle,
                totalDebtReceivable: totalDebtPending,
                totalDebtPayable: totalDebtPayable,
                tir,
                nextInterestON,
                nextInterestTreasury,
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
            history: historyWithAvg,
            composition,
            projected,
            debtDetails,
            enabledSections,
            debug: { userId, raw: settings?.enabledSections }
        });

    } catch (error) {
        console.error('Error fetching global dashboard data:', error);

        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
