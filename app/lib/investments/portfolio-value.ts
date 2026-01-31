import { prisma } from '@/lib/prisma';
import { calculateFIFO } from '@/app/lib/fifo';

interface ARGMarketValueResult {
    marketValueUSD: number;
    activeCount: number;
    investmentsWithMetrics: any[];
}

/**
 * SINGLE SOURCE OF TRUTH for calculating ARG portfolio market value in USD.
 * 
 * This function is used by:
 * - dashboard-data.ts (main dashboard cards)
 * - dashboard-stats.ts (internal Cartera Argentina dashboard)
 * 
 * DO NOT duplicate this logic elsewhere. If you need to modify the calculation,
 * update this function and all consumers will automatically use the new logic.
 */
export async function calculateARGMarketValue(userId: string): Promise<ARGMarketValueResult> {
    // 1. Fetch investments
    const investments = await prisma.investment.findMany({
        where: { userId, market: 'ARG' },
        select: {
            id: true,
            ticker: true,
            name: true,
            type: true,
            currency: true,
            lastPrice: true,
            lastPriceDate: true,
            transactions: {
                select: {
                    id: true,
                    date: true,
                    type: true,
                    quantity: true,
                    price: true,
                    commission: true,
                    currency: true
                }
            }
        }
    });

    // 2. Fetch recent prices (last 7 days) in batch
    const invIds = investments.map(i => i.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentPrices = await prisma.assetPrice.findMany({
        where: { investmentId: { in: invIds }, date: { gte: weekAgo } },
        orderBy: { date: 'desc' }
    });

    const priceMap: Record<string, { price: number, currency: string }> = {};
    recentPrices.forEach(p => {
        if (!priceMap[p.investmentId]) {
            priceMap[p.investmentId] = { price: p.price, currency: p.currency };
        }
    });

    // 3. Fetch exchange rates for historical conversions
    const rates = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' },
        take: 100
    });

    const latestExchangeRate = rates[0]?.value || 1160;

    const ratesMap: Record<string, number> = {};
    rates.forEach(r => {
        const d = r.date.toISOString().split('T')[0];
        ratesMap[d] = r.value;
    });

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
        return latestExchangeRate;
    };

    // 4. Calculate market value for each investment
    let totalMarketValueUSD = 0;
    let activeCount = 0;
    const investmentsWithMetrics: any[] = [];

    for (const inv of investments) {
        // 4a. Normalize transactions to USD for FIFO
        const fifoTxs = inv.transactions.map(t => {
            let price = t.price;
            let commission = t.commission;

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
                type: (t.type || '').toUpperCase() as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: price, // Now in USD
                commission: commission, // Now in USD
                currency: 'USD'
            };
        });

        const fifoResult = calculateFIFO(fifoTxs, inv.ticker);
        const quantity = fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0);

        // 4b. Determine current price in USD
        let currentPriceUSD = 0;

        if (priceMap[inv.id]) {
            const p = priceMap[inv.id];
            if (p.currency === 'USD') {
                currentPriceUSD = p.price;
            } else if (p.currency === 'ARS') {
                currentPriceUSD = p.price / latestExchangeRate;
            }
        } else {
            // Fallback to investment lastPrice
            const p = Number(inv.lastPrice) || 0;
            if (inv.currency === 'ARS') {
                const priceDate = inv.lastPriceDate ? new Date(inv.lastPriceDate) : new Date();
                const rateAtPriceDate = getRate(priceDate);
                const r = rateAtPriceDate > 0 ? rateAtPriceDate : latestExchangeRate;
                currentPriceUSD = p / r;
            } else {
                currentPriceUSD = p;
            }
        }

        // 4c. ON/BOND Price Normalization (percentage quote)
        if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && currentPriceUSD > 2.0) {
            currentPriceUSD = currentPriceUSD / 100;
        }

        const marketValueUSD = quantity * currentPriceUSD;
        const costBasisUSD = fifoResult.openPositions.reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);

        if (quantity > 0) {
            totalMarketValueUSD += marketValueUSD;
            activeCount++;
        }

        investmentsWithMetrics.push({
            ...inv,
            quantity,
            currentPriceUSD,
            marketValueUSD,
            costBasisUSD,
            fifoResult
        });
    }

    return {
        marketValueUSD: totalMarketValueUSD,
        activeCount,
        investmentsWithMetrics
    };
}
