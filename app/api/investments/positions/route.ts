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

        const targetCurrency = searchParams.get('currency');
        let ratesMap: Record<string, number> = {};

        // If conversion is needed, fetch rates
        if (targetCurrency) {
            const rates = await prisma.economicIndicator.findMany({
                where: { type: 'BLUE' }, // Assuming BLUE is the type for Dolar Blue
                select: { date: true, value: true }
            });
            rates.forEach(r => {
                const d = r.date.toISOString().split('T')[0];
                ratesMap[d] = r.value;
            });
        }

        // Helper to find closest rate
        const getRate = (date: Date) => {
            const dateStr = date.toISOString().split('T')[0];
            if (ratesMap[dateStr]) return ratesMap[dateStr];
            // Naive fallback: find closest? For now just return 0 or handle error?
            // Let's assume data is dense enough or fallback to 'latest' found so far?
            // Simple approach: look for exact match, if not found, assume 1 (to avoid crash) but this implies error.
            // Better: Find latest available rate before or on date.
            // Given the map is not sorted, we might need a sorted array.
            // But since we are inside a route, let's keep it simple: exact match or use a recent one?
            // For now, exact match logic or fallback to most recent previous rate (re-query db? too slow).
            // Let's rely on the map. If missing, maybe use the last known rate from iteration?
            return ratesMap[dateStr] || 0;
        };

        // 2. Group transactions by Ticker (FIFO is per-asset)
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

            // NORMALIZE IF NEEDED
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

        // 3. Calculate Positions (Realized & Open) for each ticker
        let allPositions: any[] = [];

        for (const ticker in txByTicker) {
            const result = calculateFIFO(txByTicker[ticker], ticker);
            const investment = investmentMap[ticker];
            let currentPrice = investment.lastPrice || 0;

            // For ONs and Corporate Bonds, price is usually quoted as %, so divide by 100 for value calc
            if (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') {
                currentPrice = currentPrice / 100;
            }

            // Normalize Current Price (Market Price) if needed
            // Investment might have currency USD/ARS/etc.
            // We need to convert Current Price to Target Currency too!
            if (targetCurrency && targetCurrency !== investment.currency) {
                // Convert current price using LATEST rate (or rate of lastPriceDate)
                // Let's use rate of lastPriceDate if available, or today.
                const priceDate = investment.lastPriceDate || new Date();
                const rate = getRate(priceDate);

                // Fallback if rate not in map (e.g. today's rate might be in DB though)
                // Logic similar to above
                if (rate > 0) {
                    if (investment.currency === 'ARS' && targetCurrency === 'USD') {
                        currentPrice = currentPrice / rate;
                    } else if (investment.currency === 'USD' && targetCurrency === 'ARS') {
                        currentPrice = currentPrice * rate;
                    }
                }
            }

            // Map Realized Gains (already calculated in lib/fifo)
            const realizedEvents = result.realizedGains.map(g => ({
                id: g.id,
                date: g.date,
                ticker: g.ticker,
                name: investment.name,
                status: g.status,
                quantity: g.quantity,
                buyPrice: g.buyPriceAvg, // Map Avg to generic buyPrice
                buyCommission: g.buyCommissionPaid, // Map Paid to generic buyCommission
                sellPrice: g.sellPrice,
                sellCommission: g.sellCommission,
                resultAbs: g.gainAbs,
                resultPercent: g.gainPercent,
                currency: g.currency,
                currentPrice: 0, // Not relevant for closed
                unrealized: false
            }));

            // Map Open Positions -> Add Unrealized P&L
            const openEvents = result.openPositions.map(p => {
                const totalCost = (p.quantity * p.buyPrice) + p.buyCommission;
                const currentValue = p.quantity * currentPrice; // Gross value?
                // Unrealized Result = CurrentValue - TotalCost
                // (Asset Value) - (Invested Capital including commissions)

                // Note: Selling usually incurs another commission. We are not projecting that here unless asked.
                // User asked for "Resultado" (Result). 

                const resultAbs: number | null = currentPrice > 0 ? currentValue - totalCost : null;
                const resultPercent: number | null = currentPrice > 0 && totalCost !== 0 ? ((currentValue - totalCost) / totalCost) * 100 : null;

                return {
                    id: p.id,
                    date: p.date, // Purchase Date
                    ticker: p.ticker,
                    name: investment.name,
                    status: 'OPEN',
                    quantity: p.quantity,
                    buyPrice: p.buyPrice,
                    buyCommission: p.buyCommission,
                    sellPrice: currentPrice > 0 ? currentPrice : 0,
                    sellCommission: 0,
                    resultAbs: resultAbs ?? 0, // Fallback to 0 for type safety but UI handles it? No, let's keep it null if interface allows
                    resultPercent: resultPercent ?? 0,
                    currency: targetCurrency || p.currency, // Force view currency if set
                    unrealized: true
                };
            });

            allPositions = [...allPositions, ...realizedEvents, ...openEvents];
        }

        // 4. Sort by Date Descending (Most recent event first)
        // For Open positions: Purchase Date. For Closed: Sale Date.
        allPositions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(allPositions);

    } catch (error) {
        console.error('Error calculating positions:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
