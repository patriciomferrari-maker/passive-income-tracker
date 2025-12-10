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

        const typeFilter = typeParam ? {
            investment: {
                type: {
                    in: typeParam.split(',')
                }
            }
        } : {};

        // 1. Fetch all transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId,
                },
                ...typeFilter
            },
            include: {
                investment: true
            },
            orderBy: {
                date: 'asc'
            }
        });

        // 2. Group transactions by Ticker (FIFO is per-asset)
        const txByTicker: Record<string, FIFOTransaction[]> = {};
        const investmentMap: Record<string, any> = {};

        for (const tx of transactions) {
            const ticker = tx.investment.ticker;
            if (!txByTicker[ticker]) {
                txByTicker[ticker] = [];
                investmentMap[ticker] = tx.investment;
            }

            txByTicker[ticker].push({
                id: tx.id,
                date: tx.date,
                type: tx.type as 'BUY' | 'SELL',
                quantity: tx.quantity,
                price: tx.price,
                commission: tx.commission,
                currency: tx.currency
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

            // Map Realized Gains (already calculated in lib/fifo)
            const realizedEvents = result.realizedGains.map(g => ({
                ...g,
                name: investment.name,
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
                    currency: p.currency,
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
