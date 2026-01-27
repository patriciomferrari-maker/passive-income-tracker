
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
            transactions: { orderBy: { date: 'asc' } },
            cashflows: { orderBy: { date: 'asc' } }
        }
    });

    // 2. Fetch Exchange Rates History for Normalization
    const rates = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });

    // Helper: Rates Map for O(1) lookup
    const ratesMap: Record<string, number> = {};
    rates.forEach(r => {
        const d = r.date.toISOString().split('T')[0];
        ratesMap[d] = r.value;
    });

    // Helper to find historical rate (Same fallback logic as Positions Route)
    const getRate = (date: Date): number => {
        const dateStr = date.toISOString().split('T')[0];
        if (ratesMap[dateStr]) return ratesMap[dateStr];

        // Fallback: Find closest rate in past (look back 10 days)
        let d = new Date(date);
        for (let i = 0; i < 10; i++) {
            const ds = d.toISOString().split('T')[0];
            if (ratesMap[ds]) return ratesMap[ds];
            d.setDate(d.getDate() - 1);
        }
        // Fallback to latest
        return rates[0]?.value || 1160;
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

    // We prefer USD prices if available, else latest price (which we will convert if needed)
    // Actually, positions route logic is complex with currency checks.
    // For simplicity, we assume we want USD.
    const priceMap: Record<string, { price: number, currency: string }> = {};
    recentPrices.forEach(p => {
        // Prefer capturing the USD price if multiple exist? 
        // Just take the most recent one for now.
        if (!priceMap[p.investmentId]) priceMap[p.investmentId] = { price: p.price, currency: p.currency };
    });


    // 4. Calculate Positions & Metrics (Enriching Investments)
    const investmentsWithMetrics: any[] = [];

    // Init Consolidated P&L Tracking
    let totalRealizedUSD = 0;
    let totalCostRealizedUSD = 0;
    let totalUnrealizedUSD = 0;
    let accumulatedCapitalInvertidoUSD = 0; // Total Cost Basis of Open Positions

    // Use a loop to calculate FIFO and enrich each investment
    for (const inv of investments) {
        // NORMALIZE TRANSACTIONS TO USD BEFORE FIFO
        // This ensures FIFO runs on a uniform currency basis, matching Holdings Tab "USD" view.
        const fifoTxs = inv.transactions.map((t: any) => {
            let price = Number(t.price);
            let commission = Number(t.commission);

            // Conversion Logic
            if (t.currency === 'ARS') {
                const rate = getRate(new Date(t.date));
                if (rate > 0) {
                    price = price / rate;
                    commission = commission / rate;
                }
            }

            return {
                id: t.id,
                date: new Date(t.date),
                type: (t.type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: price, // NOW IN USD
                commission: commission, // NOW IN USD
                currency: 'USD'
            };
        });

        const fifoResult = calculateFIFO(fifoTxs, inv.ticker);

        // Sum Open Quantity
        const quantity = fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0);

        // Determine Current Price in USD
        let currentPriceUSD = 0;

        // 1. Try Price Map
        if (priceMap[inv.id]) {
            const p = priceMap[inv.id];
            if (p.currency === 'USD') {
                currentPriceUSD = p.price;
            } else if (p.currency === 'ARS') {
                currentPriceUSD = p.price / latestExchangeRate;
            }
        }
        // 2. Fallback to Investment Last Price
        else {
            const p = Number(inv.lastPrice) || 0;
            if (inv.currency === 'ARS') {
                // Match Positions Route Logic: Use Rate at Price Date
                const priceDate = inv.lastPriceDate ? new Date(inv.lastPriceDate) : new Date();
                const rateAtPriceDate = getRate(priceDate);
                // If rate is 0/missing, fallback to latest? Positions route might return 0 price if rate 0.
                // We'll use latest as backup to avoid 0 value if possible, or stick to route logic.
                // Route logic: currentPrice = basePrice / rate.
                const r = rateAtPriceDate > 0 ? rateAtPriceDate : latestExchangeRate;
                currentPriceUSD = p / r;
            } else {
                currentPriceUSD = p;
            }
        }

        // ON/BOND Price Normalization Heuristic (Percentage Quote)
        // Same as Positions Table
        if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && currentPriceUSD > 2.0) {
            currentPriceUSD = currentPriceUSD / 100;
        }

        const marketValueUSD = quantity * currentPriceUSD;

        // P&L Aggregation (Now everything is in USD from FIFO)

        // 1. Realized Results (USD)
        const invRealizedUSD = fifoResult.realizedGains.reduce((sum, g) => sum + g.gainAbs, 0);
        // Cost Basis of Realized Gains = (Qty * BuyPriceAvg) + BuyCommissionPaid
        const invCostRealizedUSD = fifoResult.realizedGains.reduce((sum, g) => sum + ((g.quantity * g.buyPriceAvg) + g.buyCommissionPaid), 0);

        totalRealizedUSD += invRealizedUSD;
        totalCostRealizedUSD += invCostRealizedUSD;

        // 2. Unrealized Results (USD)
        // Cost Basis of Open Positions (already in USD because input was USD)

        const invCostOpenUSD = fifoResult.openPositions.reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);

        const invUnrealizedUSD = quantity > 0 ? marketValueUSD - invCostOpenUSD : 0;

        if (quantity > 0) {
            totalUnrealizedUSD += invUnrealizedUSD;
            accumulatedCapitalInvertidoUSD += invCostOpenUSD;
        }

        // Theoretical TIR (Yield)
        let theoreticalTir: number | null = null;
        if (quantity > 0 && currentPriceUSD > 0) {
            const flows = [-marketValueUSD];
            const dates = [new Date()];

            inv.cashflows.forEach((cf: any) => {
                if (cf.status === 'PROJECTED' && new Date(cf.date) > new Date()) {
                    // Cashflows need normalization too if ARS
                    let amt = cf.amount;
                    if (cf.currency === 'ARS') amt /= latestExchangeRate; // Use latest rate for projected? Or current spot? Latest is fine.
                    flows.push(amt);
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
            currentPrice: currentPriceUSD,
            marketValue: marketValueUSD,
            theoreticalTir,
            costBasisUSD: invCostOpenUSD,
            realizedUSD: invRealizedUSD,
            costRealizedUSD: invCostRealizedUSD
        });
    }

    // A. Tenencia & Valuation
    const tenenciaTotalValorActual = investmentsWithMetrics.reduce((sum, i) => sum + i.marketValue, 0);

    // B. Breakdown Map (With TIR calculation)
    const portfolioBreakdown = investmentsWithMetrics.map(inv => {
        const costBasis = inv.costBasisUSD || 0;

        // TIR (Personal Performance - Held to Maturity)
        const amounts: number[] = [];
        const dates: Date[] = [];

        // Use Normalized Transactions for TIR
        inv.transactions.forEach((tx: any) => {
            // We need to re-normalize for TIR? 
            // Yes, consistent with USD view.
            let amt = Math.abs(Number(tx.quantity * tx.price)) + Number(tx.commission); // Raw amount usually? 
            // Wait, tx.totalAmount is usually stored.
            // But let's use the logic:
            // Buy = Outflow (-), Sell = Inflow (+)
            // Convert to USD at Historical Rate

            let rawTotal = 0;
            // We need raw total from DB or calc it. 
            // DB tx usually has totalAmount? No, we might calculate it.
            // Let's use Price * Quantity + Com.
            const p = Number(tx.price);
            const q = Number(tx.quantity);
            const c = Number(tx.commission);
            const rawVal = (p * q) + c; // This is cost magnitude.

            let valUSD = rawVal;
            if (tx.currency === 'ARS') {
                const r = getRate(new Date(tx.date));
                if (r > 0) valUSD /= r;
            }

            if (tx.type === 'BUY') {
                amounts.push(-valUSD);
            } else {
                // For Sell, it's inflow. Commission reduces inflow? 
                // Usually (P*Q) - C.
                // Above calc was (P*Q) + C.
                // Correct logic:
                // Flow = (P * Q) - C (if Sell), (P * Q) + C (if Buy).
                // Let's just use the signed amounts from logic.
                // Simplified:
                // If Buy: -(Price*Qty + Comm)
                // If Sell: +(Total Received)

                let flow = (Number(tx.price) * Number(tx.quantity));
                if (tx.type === 'BUY') flow = -(flow + Number(tx.commission));
                else flow = (flow - Number(tx.commission)); // Sell

                if (tx.currency === 'ARS') {
                    const r = getRate(new Date(tx.date));
                    if (r > 0) flow /= r;
                }
                amounts.push(flow);
            }
            dates.push(new Date(tx.date));
        });

        // Add ALL cashflows (Paid and Projected)
        inv.cashflows.forEach((cf: any) => {
            let val = cf.amount;
            if (cf.currency === 'ARS') {
                const isPast = new Date(cf.date) <= new Date();
                const r = isPast ? getRate(new Date(cf.date)) : latestExchangeRate;
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
    // Sort logic to put 0 value items at end? Or sort by Value descending.
    portfolioBreakdown.sort((a, b) => b.value - a.value);


    // C. Consolidated Flow & TIR
    // Use the same normalized logic
    const allAmounts: number[] = [];
    const allDates: Date[] = [];

    // Re-looping? Or we could abstract the Flow Logic. 
    // For Safety, I'll copy the logic inside the breakdown map.
    // Actually, to get Consolidated TIR, we aggregate ALL flows from ALL investments.
    portfolioBreakdown.forEach(() => { }); // No, we need fresh loop or reuse.

    // Let's do a fresh loop over investmentsWithMetrics to build consolidated streams.
    // Wait, we need Transactions AND Cashflows.
    investmentsWithMetrics.forEach(inv => {
        inv.transactions.forEach((tx: any) => {
            // Same Flow Logic as above
            // Buy = Outflow (-). Sell = Inflow (+). 
            // Note: Route.ts previously only used BUY for "Purchase Yield"? 
            // "Purchase Yield" implies "Yield on specific purchases".
            // But "Consolidated TIR" usually implies Portfolio Performance (including sells).
            // Given the mismatches, I will implement standard XIRR: All Flows.
            // But wait, above I used signed amounts. 
            // Let's verify loop above logic again.

            let flowRaw = (Number(tx.price) * Number(tx.quantity));
            if (tx.type === 'BUY') flowRaw = -(flowRaw + Number(tx.commission));
            else flowRaw = (flowRaw - Number(tx.commission));

            if (tx.currency === 'ARS') {
                const r = getRate(new Date(tx.date));
                if (r > 0) flowRaw /= r;
            }
            allAmounts.push(flowRaw);
            allDates.push(new Date(tx.date));
        });

        inv.cashflows.forEach((cf: any) => {
            let val = cf.amount;
            if (cf.currency === 'ARS') {
                const isPast = new Date(cf.date) <= new Date();
                const r = isPast ? getRate(new Date(cf.date)) : latestExchangeRate;
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
            if (cf.currency === 'ARS') amt /= (isPast ? getRate(new Date(cf.date)) : latestExchangeRate);

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

    // Map to simple structure
    const upcomingPayments = allFuture.slice(0, 200).map((cf: any) => ({
        date: cf.date,
        amount: cf.amount, // Return RAW amount for display logic
        ticker: cf.ticker,
        type: cf.type
    }));

    // Calculate Percentages for P&L
    const unrealizedPercent = accumulatedCapitalInvertidoUSD > 0 ? (totalUnrealizedUSD / accumulatedCapitalInvertidoUSD) * 100 : 0;
    const realizedPercent = totalCostRealizedUSD > 0 ? (totalRealizedUSD / totalCostRealizedUSD) * 100 : 0;

    return {
        investments: investmentsWithMetrics,
        capitalInvertido: accumulatedCapitalInvertidoUSD, // Normalized USD Cost Basis from OPEN POSITIONS
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
        totalONs: investments.filter(i => ['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO', 'CEDEAR', 'ETF', 'STOCK'].includes(i.type || '')).length, // Include ALL types
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
