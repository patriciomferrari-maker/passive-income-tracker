
import { prisma } from '@/lib/prisma';
import { calculateXIRR } from '@/lib/financial';
import { calculateFIFO } from '@/app/lib/fifo';

// Types mimicking the return of the Dashboard API
export interface DashboardStats {
    investments: any[]; // Raw investments list for tables
    capitalInvertido: number;
    capitalCobrado: number;
    interesCobrado: number;
    capitalACobrar: number;
    interesACobrar: number;
    totalACobrar: number;
    roi: number;
    tirConsolidada: number;
    proximoPago: any | null;
    upcomingPayments: any[];
    portfolioBreakdown: any[];
    totalONs: number;
    totalInvestments: number;
    totalTransactions: number;
    totalCurrentValue: number;
    pnl: any | null;
}

export async function getONDashboardStats(userId: string): Promise<DashboardStats> {
    // 1. Fetch Basic Data (Investments + Transactions + Cashflows)
    const investments = await prisma.investment.findMany({
        where: {
            userId,
            market: 'ARG',
            transactions: { some: {} }
        },
        include: {
            transactions: true,
            cashflows: { orderBy: { date: 'asc' } }
        }
    });

    // 2. Fetch Exchange Rates History
    const rates = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });

    // Helper to find historical rate
    const getExchangeRate = (date: Date): number => {
        const rate = rates.find(r => r.date <= date);
        if (rate) return rate.value;
        if (rates.length > 0) return rates[rates.length - 1].value;
        return 1200; // Fallback
    };
    const latestExchangeRate = rates[0]?.value || 1160;

    // 3. Asset Prices (Latest) - for Open Positions Valuation
    const invIds = investments.map(i => i.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentPrices = await prisma.assetPrice.findMany({
        where: { investmentId: { in: invIds }, date: { gte: weekAgo } },
        orderBy: { date: 'desc' }
    });
    const priceMap: Record<string, number> = {};
    recentPrices.forEach(p => { if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price; });


    // 4. Calculate Positions & Metrics (Enriching Investments)
    const investmentsWithMetrics: any[] = [];

    // Init Consolidated P&L Tracking
    let totalRealized = 0;
    let totalUnrealized = 0;
    let capitalInvertido = 0;

    // Use a loop to calculate FIFO and enrich each investment
    for (const inv of investments) {
        // FIFO Calc
        const fifoTxs = inv.transactions.map(t => ({
            id: t.id,
            date: new Date(t.date),
            type: (t.type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
            quantity: t.quantity,
            price: t.price,
            commission: t.commission,
            currency: t.currency
        }));

        const fifoResult = calculateFIFO(fifoTxs, inv.ticker);

        // Sum Open Quantity
        const quantity = fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0);

        // Price Logic
        let rawPrice = priceMap[inv.id] !== undefined ? priceMap[inv.id] : (Number(inv.lastPrice) || 0);
        // Norm /100 for ONs
        if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && rawPrice > 2.0) {
            rawPrice = rawPrice / 100;
        }

        // Currency Detect (Heuristic)
        let priceUSD = rawPrice;
        if (priceUSD > 50.0) {
            priceUSD = priceUSD / latestExchangeRate;
        }

        const currentValue = quantity * priceUSD;

        // P&L Aggregation
        // 1. Realized Results
        let invRealizedUSD = 0;
        let invCostRealizedUSD = 0;

        fifoResult.realizedGains.forEach(g => {
            let gain = g.gainAbs;
            let cost = g.basisCost;
            if (g.currency === 'ARS') {
                const rate = getExchangeRate(new Date(g.sellDate));
                gain /= rate;
                // Standardize cost realized
                cost /= rate;
            }
            invRealizedUSD += gain;
            invCostRealizedUSD += cost;
        });
        totalRealized += invRealizedUSD;

        // 2. Unrealized Results
        // Cost Basis of Open Positions in USD
        let invCostOpenUSD = 0;
        fifoResult.openPositions.forEach(p => {
            let cost = (p.quantity * p.buyPrice) + p.buyCommission;
            if (p.currency === 'ARS') {
                // We need rate at purchase date.
                const rate = getExchangeRate(new Date(p.date));
                cost /= rate;
            }
            invCostOpenUSD += cost;
        });

        const invUnrealizedUSD = currentValue - invCostOpenUSD;

        if (quantity > 0) {
            totalUnrealized += invUnrealizedUSD;
            capitalInvertido += invCostOpenUSD;
        }

        // Theoretical TIR (Yield)
        let theoreticalTir: number | null = null;
        if (quantity > 0 && priceUSD > 0) {
            const flows = [-currentValue];
            const dates = [new Date()];

            inv.cashflows.forEach(cf => {
                if (cf.status === 'PROJECTED' && new Date(cf.date) > new Date()) {
                    flows.push(cf.amount);
                    dates.push(new Date(cf.date));
                }
            });

            if (flows.length > 1) {
                const t = calculateXIRR(flows, dates);
                if (t) theoreticalTir = t * 100;
            }
        }

        investmentsWithMetrics.push({
            ...inv,
            quantity,
            currentPrice: priceUSD,
            marketValue: currentValue,
            theoreticalTir,
            costBasisUSD: invCostOpenUSD,
            realizedUSD: invRealizedUSD,
            costRealizedUSD: invCostRealizedUSD
        });
    }

    // A. Tenencia & Valuation
    const tenenciaTotalValorActual = investmentsWithMetrics.reduce((sum, i) => sum + i.marketValue, 0);
    const totalCostRealized = investmentsWithMetrics.reduce((sum, i) => sum + (i.costRealizedUSD || 0), 0);

    // B. Breakdown Map (With TIR calculation)
    const portfolioBreakdown = investmentsWithMetrics.map(inv => {
        const costBasis = inv.costBasisUSD || 0;

        // TIR (Personal Performance - Held to Maturity)
        const amounts: number[] = [];
        const dates: Date[] = [];

        inv.transactions.forEach((tx: any) => {
            let amt = -Math.abs(tx.totalAmount); // Outflow
            if (tx.type === 'SELL') amt = Math.abs(tx.totalAmount); // Inflow
            if (tx.currency === 'ARS') amt /= getExchangeRate(new Date(tx.date));
            amounts.push(amt);
            dates.push(new Date(tx.date));
        });

        // Add ALL cashflows (Paid and Projected)
        inv.cashflows.forEach((cf: any) => {
            let val = cf.amount;
            if (cf.currency === 'ARS') {
                const isPast = new Date(cf.date) <= new Date();
                const r = isPast ? getExchangeRate(new Date(cf.date)) : latestExchangeRate;
                if (r > 0) val /= r;
            }
            amounts.push(val);
            dates.push(new Date(cf.date));
        });

        let calculatedTir = null;
        if (amounts.length > 1) {
            const t = calculateXIRR(amounts, dates);
            if (t) calculatedTir = t;
        }

        return {
            ticker: inv.ticker,
            name: inv.name,
            tir: calculatedTir ? calculatedTir * 100 : 0,
            marketTir: inv.theoreticalTir || 0,
            type: inv.type,
            value: inv.marketValue,
            invested: costBasis,
            percentage: 0
        };
    }).filter(i => i.value > 0 || i.tir !== 0);

    // Calculate Percentages
    const totalBreakdownValue = portfolioBreakdown.reduce((sum, i) => sum + i.value, 0);
    if (totalBreakdownValue > 0) {
        portfolioBreakdown.forEach(i => i.percentage = (i.value / totalBreakdownValue) * 100);
    }

    // C. Consolidated Flow & TIR
    const allAmounts: number[] = [];
    const allDates: Date[] = [];

    investmentsWithMetrics.forEach(inv => {
        inv.transactions.forEach((tx: any) => {
            if (tx.type === 'BUY') {
                let val = -Math.abs(tx.totalAmount);
                if (tx.currency === 'ARS') val /= getExchangeRate(new Date(tx.date));
                allAmounts.push(val);
                allDates.push(new Date(tx.date));
            }
        });

        inv.cashflows.forEach((cf: any) => {
            let val = cf.amount;
            if (cf.currency === 'ARS') {
                const r = new Date(cf.date) <= new Date() ? getExchangeRate(new Date(cf.date)) : latestExchangeRate;
                if (r > 0) val /= r;
            }
            allAmounts.push(val);
            allDates.push(new Date(cf.date));
        });
    });

    const tirConsolidada = calculateXIRR(allAmounts, allDates);

    // D. Cards Data (Cobrado / A Cobrar)
    let capitalCobrado = 0;
    let interesCobrado = 0;
    let capitalACobrar = 0;
    let interesACobrar = 0;
    const today = new Date();

    investmentsWithMetrics.forEach(inv => {
        inv.cashflows.forEach((cf: any) => {
            if (cf.status !== 'PROJECTED' && cf.status !== 'PAID') return;
            const isPast = new Date(cf.date) <= today;
            let amt = cf.amount;
            if (cf.currency === 'ARS') amt /= (isPast ? getExchangeRate(new Date(cf.date)) : latestExchangeRate);

            if (cf.type === 'AMORTIZATION') {
                if (cf.status === 'PAID' || (cf.status === 'PROJECTED' && isPast)) {
                    capitalCobrado += amt;
                } else {
                    capitalACobrar += amt;
                }
            } else if (cf.type === 'INTEREST') {
                if (cf.status === 'PAID' || (cf.status === 'PROJECTED' && isPast)) {
                    interesCobrado += amt;
                } else {
                    interesACobrar += amt;
                }
            }
        });

    });

    const totalACobrar = capitalACobrar + interesACobrar;
    const roi = capitalInvertido > 0 ? ((capitalCobrado + interesCobrado + totalACobrar - capitalInvertido) / capitalInvertido) * 100 : 0;

    // Upcoming Payments
    const allFuture = investmentsWithMetrics.flatMap(inv => inv.cashflows
        .filter((cf: any) => cf.status === 'PROJECTED' && new Date(cf.date) > today)
        .map((cf: any) => ({ ...cf, ticker: inv.ticker, name: inv.name }))
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Map to simple structure
    const upcomingPayments = allFuture.slice(0, 200).map((cf: any) => ({
        date: cf.date,
        amount: cf.amount, // Raw or Normalized? route.ts returns Raw.
        ticker: cf.ticker,
        type: cf.type
    }));

    // Calculate Percentages for P&L
    const unrealizedPercent = capitalInvertido > 0 ? (totalUnrealized / capitalInvertido) * 100 : 0;
    const realizedPercent = totalCostRealized > 0 ? (totalRealized / totalCostRealized) * 100 : 0;

    return {
        investments: investmentsWithMetrics,
        capitalInvertido,
        capitalCobrado,
        interesCobrado,
        capitalACobrar,
        interesACobrar,
        totalACobrar,
        roi,
        tirConsolidada: tirConsolidada ? tirConsolidada * 100 : 0,
        proximoPago: upcomingPayments[0] || null,
        upcomingPayments,
        portfolioBreakdown,
        totalONs: investments.filter(i => ['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(i.type || '')).length,
        totalInvestments: investments.length,
        totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
        totalCurrentValue: tenenciaTotalValorActual,
        pnl: {
            realized: totalRealized,
            realizedPercent,
            unrealized: totalUnrealized,
            unrealizedPercent,
            hasEquity: true // Always valid now
        }
    };
}
