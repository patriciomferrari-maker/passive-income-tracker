
import { prisma } from '@/lib/prisma';
import { calculateXIRR } from '@/lib/financial';
import { calculateFIFO } from '@/app/lib/fifo';

// Types mimicking the return of the Dashboard API
export interface DashboardStats {
    investments: any[];
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
    totalONs: number; // Reused for compatibility
    totalInvestments: number;
    totalTransactions: number;
    totalCurrentValue: number;
    pnl: any | null;
}

export async function getUSDashboardStats(userId: string): Promise<DashboardStats> {
    // 1. Fetch Basic Data (Investments + Transactions + Cashflows)
    const investments = await prisma.investment.findMany({
        where: {
            userId,
            market: 'US',
            transactions: { some: {} }
        },
        include: {
            transactions: { orderBy: { date: 'asc' } },
            cashflows: { orderBy: { date: 'asc' } }
        }
    });

    // 2. Asset Prices (Latest) - for Open Positions Valuation
    const invIds = investments.map(i => i.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentPrices = await prisma.assetPrice.findMany({
        where: { investmentId: { in: invIds }, date: { gte: weekAgo } },
        orderBy: { date: 'desc' }
    });

    const priceMap: Record<string, number> = {};
    recentPrices.forEach(p => {
        if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price;
    });

    // 4. Calculate Positions & Metrics (Enriching Investments)
    const investmentsWithMetrics: any[] = [];

    // Init Consolidated P&L Tracking
    let totalRealizedUSD = 0;
    let totalCostRealizedUSD = 0;
    let totalUnrealizedUSD = 0;
    let accumulatedCapitalInvertidoUSD = 0; // Total Cost Basis of Open Positions

    for (const inv of investments) {
        // Transactions are already in USD for US Market usually.
        // But for safety, we assume they are USD.
        const fifoTxs = inv.transactions.map((t: any) => ({
            id: t.id,
            date: new Date(t.date),
            type: (t.type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
            quantity: t.quantity,
            price: Number(t.price),
            commission: Number(t.commission),
            currency: 'USD'
        }));

        const fifoResult = calculateFIFO(fifoTxs, inv.ticker);

        // Sum Open Quantity
        const quantity = fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0);

        // Determine Current Price
        let currentPrice = priceMap[inv.id] || Number(inv.lastPrice) || 0;

        // Treasury Price Normalization (Quote % vs Raw)
        if (inv.type === 'TREASURY' && currentPrice > 2.0) {
            currentPrice = currentPrice / 100;
        }

        const marketValueUSD = quantity * currentPrice;

        // P&L Aggregation
        const invRealizedUSD = fifoResult.realizedGains.reduce((sum, g) => sum + g.gainAbs, 0);
        const invCostRealizedUSD = fifoResult.realizedGains.reduce((sum, g) => sum + ((g.quantity * g.buyPriceAvg) + g.buyCommissionPaid), 0);

        totalRealizedUSD += invRealizedUSD;
        totalCostRealizedUSD += invCostRealizedUSD;


        const invCostOpenUSD = fifoResult.openPositions.reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);
        const invUnrealizedUSD = quantity > 0 ? marketValueUSD - invCostOpenUSD : 0;

        if (quantity > 0 && currentPrice > 0) {
            totalUnrealizedUSD += invUnrealizedUSD;
            accumulatedCapitalInvertidoUSD += invCostOpenUSD;
        }

        // Theoretical TIR
        let theoreticalTir: number | null = null;
        if (quantity > 0 && currentPrice > 0) {
            const flows = [-marketValueUSD];
            const dates = [new Date()];

            inv.cashflows.forEach((cf: any) => {
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
            currentPrice,
            marketValue: marketValueUSD,
            theoreticalTir,
            costBasisUSD: invCostOpenUSD,
            realizedUSD: invRealizedUSD,
            costRealizedUSD: invCostRealizedUSD
        });
    }

    const tenenciaTotalValorActual = investmentsWithMetrics.reduce((sum, i) => sum + i.marketValue, 0);

    // Breakdown
    const portfolioBreakdown = investmentsWithMetrics.map(inv => {
        const costBasis = inv.costBasisUSD || 0;

        // TIR (Personal Performance)
        const amounts: number[] = [];
        const dates: Date[] = [];

        inv.transactions.forEach((tx: any) => {
            // Flow Logic:
            // Buy: -( (P*Q) + C )
            // Sell: + ( (P*Q) - C )
            let flow = (Number(tx.price) * Number(tx.quantity));
            if (tx.type === 'BUY') flow = -(flow + Number(tx.commission));
            else flow = (flow - Number(tx.commission));

            amounts.push(flow);
            dates.push(new Date(tx.date));
        });

        inv.cashflows.forEach((cf: any) => {
            amounts.push(cf.amount); // Assume USD
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

    // Percentages
    const totalBreakdownValue = portfolioBreakdown.reduce((sum, i) => sum + i.value, 0);
    if (totalBreakdownValue > 0) {
        portfolioBreakdown.forEach(i => i.percentage = (i.value / totalBreakdownValue) * 100);
    }

    // Consolidated TIR
    const allAmounts: number[] = [];
    const allDates: Date[] = [];

    investmentsWithMetrics.forEach(inv => {
        inv.transactions.forEach((tx: any) => {
            let flow = (Number(tx.price) * Number(tx.quantity));
            if (tx.type === 'BUY') flow = -(flow + Number(tx.commission));
            else flow = (flow - Number(tx.commission));
            allAmounts.push(flow);
            allDates.push(new Date(tx.date));
        });
        inv.cashflows.forEach((cf: any) => {
            allAmounts.push(cf.amount);
            allDates.push(new Date(cf.date));
        });
    });

    const tirConsolidada = calculateXIRR(allAmounts, allDates);

    // Cards Data
    let capitalCobrado = 0;
    let interesCobrado = 0;
    let capitalACobrar = 0;
    let interesACobrar = 0;
    const today = new Date();

    investmentsWithMetrics.forEach(inv => {
        inv.cashflows.forEach((cf: any) => {
            if (cf.status !== 'PROJECTED' && cf.status !== 'PAID') return;
            const isPast = new Date(cf.date) <= today;
            const amt = cf.amount;

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
    const roi = accumulatedCapitalInvertidoUSD > 0 ? ((capitalCobrado + interesCobrado + totalACobrar - accumulatedCapitalInvertidoUSD) / accumulatedCapitalInvertidoUSD) * 100 : 0;

    // Upcoming Payments
    const allFuture = investmentsWithMetrics.flatMap(inv => inv.cashflows
        .filter((cf: any) => cf.status === 'PROJECTED' && new Date(cf.date) > today)
        .map((cf: any) => ({ ...cf, ticker: inv.ticker, name: inv.name }))
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const upcomingPayments = allFuture.slice(0, 200).map((cf: any) => ({
        date: cf.date,
        amount: cf.amount,
        ticker: cf.ticker,
        type: cf.type
    }));

    const unrealizedPercent = accumulatedCapitalInvertidoUSD > 0 ? (totalUnrealizedUSD / accumulatedCapitalInvertidoUSD) * 100 : 0;
    const realizedPercent = totalCostRealizedUSD > 0 ? (totalRealizedUSD / totalCostRealizedUSD) * 100 : 0;

    return {
        investments: investmentsWithMetrics,
        capitalInvertido: accumulatedCapitalInvertidoUSD,
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
        totalONs: investments.length, // Mapping to totalONs for UI compatibility
        totalInvestments: investments.length,
        totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
        totalCurrentValue: tenenciaTotalValorActual,
        pnl: {
            realized: totalRealizedUSD,
            realizedPercent,
            unrealized: totalUnrealizedUSD,
            unrealizedPercent,
            hasEquity: true
        }
    };
}
