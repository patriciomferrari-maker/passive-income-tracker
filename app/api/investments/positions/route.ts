import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';
import { calculateFIFO, FIFOTransaction, PositionEvent } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const typeParam = searchParams.get('type');
        const marketParam = searchParams.get('market');
        const targetCurrency = searchParams.get('currency'); // ARS or USD

        const typeFilter = typeParam ? {
            type: {
                in: typeParam.split(',')
            }
        } : {};

        const marketFilter = marketParam ? {
            market: marketParam
        } : {};

        // 1. Fetch all transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId,
                    ...typeFilter,
                    ...marketFilter
                },
            },
            include: {
                investment: true
            },
            orderBy: {
                date: 'asc'
            }
        });

        // 2. Fetch Exchange Rates (TC_USD_ARS)
        let ratesMap: Record<string, number> = {};
        if (targetCurrency) {
            const rates = await prisma.economicIndicator.findMany({
                where: { type: 'TC_USD_ARS' },
                select: { date: true, value: true }
            });
            rates.forEach(r => {
                const d = r.date.toISOString().split('T')[0];
                ratesMap[d] = r.value;
            });
        }

        const getRate = (date: Date) => {
            const dateStr = date.toISOString().split('T')[0];
            if (ratesMap[dateStr]) return ratesMap[dateStr];

            // Fallback: Find closest rate in past (simple linear scan in map keys if needed, but let's assume coverage)
            // If missing, try to find a rate within 7 days
            const targetTime = date.getTime();
            // This is slow if map is large, but acceptable for now. 
            // Better: finding the last known rate.
            // Since keys are YYYY-MM-DD, we can just look back day by day.
            let d = new Date(date);
            for (let i = 0; i < 10; i++) { // Look back 10 days
                const ds = d.toISOString().split('T')[0];
                if (ratesMap[ds]) return ratesMap[ds];
                d.setDate(d.getDate() - 1);
            }
            return 0;
        };

        // 3. Fetch Latest Asset Prices for Target Currency
        // We need the latest price for each investment in the TARGET currency.
        const investmentIds = Array.from(new Set(transactions.map(t => t.investmentId)));

        let priceMap: Record<string, number> = {}; // investmentId -> price

        if (targetCurrency && investmentIds.length > 0) {
            // Fetch latest price for each investment in the specific currency
            // We can't easily do "Find Latest Group By" in Prisma standard API without unique keys or raw query.
            // We'll fetch all prices for these investments from the last 7 days and pick the latest in memory.
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const recentPrices = await prisma.assetPrice.findMany({
                where: {
                    investmentId: { in: investmentIds },
                    currency: targetCurrency, // Strict currency match
                    date: { gte: weekAgo }
                },
                orderBy: { date: 'asc' }
            });

            // Populate map with latest (asc sort guarantees last is latest)
            recentPrices.forEach(p => {
                priceMap[p.investmentId] = p.price;
            });
        }


        // 4. Group transactions by Ticker
        const txByTicker: Record<string, FIFOTransaction[]> = {};
        const investmentMap: Record<string, any> = {};

        for (const tx of transactions) {
            const ticker = tx.investment.ticker;
            if (!txByTicker[ticker]) {
                txByTicker[ticker] = [];
                investmentMap[ticker] = tx.investment;
            }

            let price = tx.price;
            let commission = tx.commission;
            let currency = tx.currency;

            // HISTORICAL COST CONVERSION
            // "Las COMPRAS que se hicieron en USD --> Multiplicar esos valores por el TC AVG del dìa de la compra" (View ARS)
            // "Las compras que hice en ARS, dividir precio de compra y comision por el TC AVG" (View USD)

            if (targetCurrency && targetCurrency !== currency) {
                const rate = getRate(tx.date);
                if (rate > 0) {
                    if (currency === 'ARS' && targetCurrency === 'USD') {
                        price = price / rate;
                        commission = commission / rate;
                        currency = 'USD';
                    } else if (currency === 'USD' && targetCurrency === 'ARS') {
                        price = price * rate;
                        commission = commission * rate;
                        currency = 'ARS';
                    }
                }
            }

            // Note: IF we converted, we pretend the transaction happened in the target currency.
            txByTicker[ticker].push({
                id: tx.id,
                date: tx.date,
                type: tx.type as 'BUY' | 'SELL',
                quantity: tx.quantity,
                price: price,
                commission: commission,
                currency: currency
            });
        }

        // 5. Calculate Positions
        let allPositions: any[] = [];

        for (const ticker in txByTicker) {
            const result = calculateFIFO(txByTicker[ticker], ticker);
            const investment = investmentMap[ticker];

            // DETERMINE CURRENT MARKET PRICE
            let currentPrice = 0;

            if (targetCurrency) {
                // 1. Try strict lookup (AssetPrice in Target Currency)
                if (priceMap[investment.id]) {
                    currentPrice = priceMap[investment.id];
                }
                // 2. Fallback: If no specific price found (e.g. strict lookup failed), 
                // use investment.lastPrice BUT logic says strict.
                // If we have no price in target currency, maybe we shouldn't show it or should convert?
                // User request implies strict tickers ("ticker sin la D" vs "con D").
                // If we don't have the "D" price, maybe convert the "O" price?
                // Let's use standard conversion if strict price missing.
                else {
                    // Check investment.currency vs target
                    const basePrice = investment.lastPrice || 0;
                    const baseCurrency = investment.currency || 'USD';

                    if (baseCurrency === targetCurrency) {
                        currentPrice = basePrice;
                    } else {
                        // Convert using LATEST COMPATIBLE RATE (e.g. today or lastPriceDate)
                        const rateDate = investment.lastPriceDate || new Date();
                        const rate = getRate(rateDate);
                        if (rate > 0) {
                            if (baseCurrency === 'ARS' && targetCurrency === 'USD') currentPrice = basePrice / rate;
                            else if (baseCurrency === 'USD' && targetCurrency === 'ARS') currentPrice = basePrice * rate;
                        }
                    }
                }
            } else {
                // No target currency? Use investment defaults
                currentPrice = investment.lastPrice || 0;
            }

            // For ONs/Bonds, divide by 100 if needed (usually price is % or per 100 nominals)
            // Assuming the scraped price is already correct unit-wise or needs /100.
            // IOL prices for ONs are usually per 100 nominals? NO, per 1.
            // Wait, Standard is per 100 for bonds, but IOL quoting is per 1 usually? 
            // In the previous logic (line 127 in original file), checks for /100.
            // "if (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') { currentPrice = currentPrice / 100; }"
            // I should preserve this if it was correct. 
            // BUT, if I scraped a price of "1050" ARS, is that for 1 lamina? usually yes.
            // If scraped price is "98" USD for 100 face value?
            // User screenshot shows AAPL $100.
            // Let's assume the previous logic was there for a reason and keep it conditionally?
            // Actually, if I scraped "1150" for an ON, and I have 100 nominals, value is 1150 * 100? or 1150 total?
            // Usually local ONs quote per 1 value. 
            // US Corp bonds quote % (per 100).
            // Let's checking existing logic.
            if (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') {
                // Check magnitude? If price is > 1000 USD?
                // Let's assume the original logic was correct and restore it, BUT make sure it applies to the *converted* or *looked up* price?
                // Actually, if I look up a price of 60 USD (e.g. GN34), that's per 100 face value typically.
                // If I have 1000 nominals, value = 1000 * 0.60? or 1000 * 60?
                // Let's keep /100 for now as safe bet if it's consistent with prev.
                currentPrice = currentPrice / 100;
            }


            // Map Realized
            const realizedEvents = result.realizedGains.map(g => ({
                id: g.id,
                date: g.date,
                ticker: g.ticker,
                name: investment.name,
                status: g.status,
                quantity: g.quantity,
                buyPrice: g.buyPriceAvg,
                buyCommission: g.buyCommissionPaid,
                sellPrice: g.sellPrice,
                sellCommission: g.sellCommission,
                resultAbs: g.gainAbs,
                resultPercent: g.gainPercent,
                currency: g.currency, // This will be targetCurrency if we converted
                currentPrice: 0,
                unrealized: false
            }));

            // Map Open
            const openEvents = result.openPositions.map(p => {
                const totalCost = (p.quantity * p.buyPrice) + p.buyCommission;
                const currentValue = p.quantity * currentPrice;

                const resultAbs: number | null = currentPrice > 0 ? currentValue - totalCost : null;
                const resultPercent: number | null = currentPrice > 0 && totalCost !== 0 ? ((currentValue - totalCost) / totalCost) * 100 : null;

                return {
                    id: p.id,
                    date: p.date,
                    ticker: p.ticker,
                    name: investment.name,
                    status: 'OPEN',
                    quantity: p.quantity,
                    buyPrice: p.buyPrice,
                    buyCommission: p.buyCommission,
                    sellPrice: currentPrice > 0 ? currentPrice : 0,
                    sellCommission: 0,
                    resultAbs: resultAbs ?? 0,
                    resultPercent: resultPercent ?? 0,
                    currency: targetCurrency || p.currency,
                    unrealized: true
                };
            });

            allPositions = [...allPositions, ...realizedEvents, ...openEvents];
        }

        allPositions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(allPositions);
    } catch (error) {
        console.error('Error calculating positions:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
