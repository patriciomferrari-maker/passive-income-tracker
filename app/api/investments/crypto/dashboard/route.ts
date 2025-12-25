import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { calculateFIFO } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();

        // Get all crypto investments
        const investments = await prisma.investment.findMany({
            where: {
                userId,
                type: 'CRYPTO',
                market: 'CRYPTO',
                transactions: {
                    some: {} // Only investments with transactions
                }
            },
            include: {
                transactions: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        // Calculate P&L using FIFO
        let totalInvested = 0;
        let totalCurrentValue = 0;
        let totalRealized = 0;
        let totalUnrealized = 0;

        const portfolioBreakdown = investments.map(inv => {
            const fifoTxs = inv.transactions.map(t => ({
                id: t.id,
                date: new Date(t.date),
                type: t.type as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: t.price,
                commission: t.commission,
                currency: t.currency
            }));

            const fifoResult = calculateFIFO(fifoTxs, inv.ticker);

            // Realized gains
            let realized = 0;
            fifoResult.realizedGains.forEach(g => {
                realized += g.gainAbs;
            });

            // Unrealized gains (current positions)
            const currentPrice = inv.lastPrice || 0;
            let unrealized = 0;
            let currentValue = 0;
            let costBasis = 0;

            fifoResult.openPositions.forEach(p => {
                const cost = (p.quantity * p.buyPrice) + p.buyCommission;
                const value = p.quantity * currentPrice;
                costBasis += cost;
                currentValue += value;
                unrealized += (value - cost);
            });

            totalRealized += realized;
            totalUnrealized += unrealized;
            totalCurrentValue += currentValue;

            // Calculate total invested for this crypto
            const invested = inv.transactions
                .filter(tx => tx.type === 'BUY')
                .reduce((sum, tx) => sum + Math.abs(tx.totalAmount), 0);

            totalInvested += invested;

            return {
                ticker: inv.ticker,
                name: inv.name,
                invested: costBasis,
                currentValue,
                unrealized,
                unrealizedPercent: costBasis > 0 ? (unrealized / costBasis) * 100 : 0,
                quantity: fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0),
                avgPrice: costBasis / fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0) || 0,
                currentPrice
            };
        }).filter(item => item.quantity > 0); // Only show coins with open positions

        // Calculate portfolio metrics
        const totalPnL = totalRealized + totalUnrealized;
        const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

        // Find top performer
        const topPerformer = portfolioBreakdown.length > 0
            ? portfolioBreakdown.reduce((max, item) =>
                item.unrealizedPercent > max.unrealizedPercent ? item : max
            )
            : null;

        return NextResponse.json({
            totalInvested,
            totalCurrentValue,
            totalRealized,
            totalUnrealized,
            totalPnL,
            totalPnLPercent,
            totalCoins: investments.length,
            totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
            portfolioBreakdown,
            topPerformer
        });
    } catch (error) {
        console.error('Error fetching crypto dashboard data:', error);

        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
