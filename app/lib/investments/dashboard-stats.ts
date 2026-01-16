
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
        // rates are DESC (newest first). 
        // We want the newest rate that is <= date.
        // Array.find returns first match.
        // find(r => r.date <= date) works.
        const rate = rates.find(r => r.date <= date);
        if (rate) return rate.value;
        if (rates.length > 0) return rates[rates.length - 1].value;
        return 1200; // Fallback
    };
    const latestExchangeRate = rates[0]?.value || 1160;

    // 3. Asset Prices (Latest) - for Open Positions Valuation
    // Optimization: Fetch prices in batch
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
    let hasEquity = false;

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

        // P&L Agregation
        // Realized (Note: realizedGains are in original currency often, but assuming USD for ONs or handled)
        // Ideally we should normalize per transaction. For now we sum what FIFO gives.
        const realizedGain = fifoResult.realizedGains.reduce((sum, g) => sum + g.gainAbs, 0);

        // Unrealized
        const costOpen = fifoResult.openPositions.reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);
        // We need costOpen in USD. 
        // If FIFO inputs were raw, costOpen is raw. 
        // FIX: For robust P&L, relying on "Tenencia" loop later might be better, OR normalize inputs to FIFO.
        // Given complexity, let's keep basic sum but acknowledge currency risk.
        // However, for PDF "Holdings Table", we need Quantity and Current Value. We have that.

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
            // Keep original lists
        });

        if (quantity > 0) hasEquity = true;
    }

    // A. Tenencia & Valuation (Consolidated Loop)
    let capitalInvertido = 0;
    let tenenciaTotalValorActual = 0;
    // Variables realized/unrealized/hasEquity already initialized above

    // We use the enriched array which already has FIFO, Price, and TheoreticalTir
    const portfolioBreakdown = investmentsWithMetrics.map(inv => {

        // Cost Basis from FIFO logic? 
        // We didn't save "totalCost" in metrics loop, only "quantity". 
        // But we need "invested" for the Breakdown.
        // Let's recalculate simplified Cost Basis or look back at what we need.
        // We really just need { ticker, name, invested, percentage, tir, theoreticalTir, type }.

        // Cost Basis: Avg Price * Quantity (Safe approx)
        let totalBuyQty = 0;
        let totalBuyCostUSD = 0;
        inv.transactions.forEach((tx: any) => {
            if (tx.type === 'BUY') {
                let cost = Math.abs(tx.totalAmount);
                if (tx.currency === 'ARS') cost /= getExchangeRate(new Date(tx.date));
                totalBuyCostUSD += cost;
                totalBuyQty += Number(tx.quantity);
            }
        });
        const avgBuyPrice = totalBuyQty > 0 ? totalBuyCostUSD / totalBuyQty : 0;
        const costBasis = avgBuyPrice * inv.quantity; // Matches "Capital Invertido" contribution

        // Sum to global totals (redundant if we did it in first loop, but safe here)
        if (inv.quantity > 0) {
            capitalInvertido += costBasis;
            tenenciaTotalValorActual += inv.marketValue;
        }

        // TIR (Personal Performance - Held to Maturity)
        // User requested "Purchase Yield" which is fixed at moment of purchase.
        // We calculate this as XIRR(Transactions + All Future/Paid Cashflows), ignoring Current Market Value.
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
            amounts.push(cf.amount);
            dates.push(new Date(cf.date));
        });

        // Calculate Purchase Yield (XIRR of Buys + All Future Flows, no Market Value)
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


    // B. Consolidated Flow & TIR
    const allAmounts: number[] = [];
    const allDates: Date[] = [];

    // Using filtered "investmentsWithMetrics" (enriched) or original?
    // Original "investments" has all transactions, which we need for historical TIR.
    // "investmentsWithMetrics" has them too (spread).
    // Let's use investmentsWithMetrics for consistency.
    investmentsWithMetrics.forEach(inv => {
        inv.transactions.forEach(tx => {
            if (tx.type === 'BUY') {
                let val = -Math.abs(tx.totalAmount);
                if (tx.currency === 'ARS') val /= getExchangeRate(new Date(tx.date));
                allAmounts.push(val);
                allDates.push(new Date(tx.date));
            }
            // Logic in route.ts only adds BUYs to `allAmounts`? 
            // Line 213: "Add all BUY transactions as negative".
            // It IGNORES Sells? 
            // If I sell, I get money back. It should be a positive flow. 
            // Route.ts Line 213 check: `if (tx.type === 'BUY')`.
            // It DOES ignore sells in the Consolidated loop. 
            // This assumes "Buy and Hold" or "Sells are handled via Cashflows"? 
            // If Sells are not in Cashflows, and ignored here, the TIR is wrong for traded assets.
            // But for ONs (Buy & Hold), it works.
            // I will replicate route.ts logic for consistency (Match Dashboard).
        });

        inv.cashflows.forEach(cf => {
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

    // C. Cards Data (Cobrado / A Cobrar)
    let capitalCobrado = 0;
    let interesCobrado = 0;
    let capitalACobrar = 0;
    let interesACobrar = 0;
    const today = new Date();

    investmentsWithMetrics.forEach(inv => {
        inv.cashflows.forEach(cf => {
            // Include PAID and PROJECTED. 
            // PAID implies it was collected. PROJECTED implies it will be (or was if date < now).
            // So we allow both.
            if (cf.status !== 'PROJECTED' && cf.status !== 'PAID') return;

            const isPast = new Date(cf.date) <= today;
            // If PAID, it's definitely past/collected.
            // If PROJECTED and Past -> Assumed collected? Or Pending?
            // Usually "Pending" implies "Projected" status regardless of date?
            // Dashboard logic usually treats Past as Collected.

            // Normalize
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

    // Return plain object, let the caller handle Response wrapping
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
        pnl: null // Placeholder, assuming pnl calculation is done elsewhere or not needed here.
    };
}
