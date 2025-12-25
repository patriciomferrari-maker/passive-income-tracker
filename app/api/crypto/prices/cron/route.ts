import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getCryptoPrices } from '@/app/lib/coingecko';
import { findCryptoBySymbol } from '@/app/lib/crypto-list';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron job to update all crypto prices
 * Called hourly by Vercel Cron
 * Uses CRON_SECRET for authentication
 */
export async function GET(request: Request) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get ALL crypto investments from all users
        const cryptos = await prisma.investment.findMany({
            where: {
                type: 'CRYPTO',
                market: 'CRYPTO'
            },
            select: {
                id: true,
                ticker: true,
                userId: true
            }
        });

        if (cryptos.length === 0) {
            return NextResponse.json({
                message: 'No crypto investments to update',
                updated: 0
            });
        }

        // Map tickers to CoinGecko IDs
        const coingeckoIds: string[] = [];
        const idToInvestmentIds: Record<string, string[]> = {};

        for (const crypto of cryptos) {
            const cryptoInfo = findCryptoBySymbol(crypto.ticker);
            if (cryptoInfo) {
                if (!coingeckoIds.includes(cryptoInfo.coingeckoId)) {
                    coingeckoIds.push(cryptoInfo.coingeckoId);
                }
                if (!idToInvestmentIds[cryptoInfo.coingeckoId]) {
                    idToInvestmentIds[cryptoInfo.coingeckoId] = [];
                }
                idToInvestmentIds[cryptoInfo.coingeckoId].push(crypto.id);
            }
        }

        if (coingeckoIds.length === 0) {
            return NextResponse.json({
                message: 'No recognized cryptocurrencies to update',
                updated: 0
            });
        }

        // Fetch prices from CoinGecko
        const prices = await getCryptoPrices(coingeckoIds);

        // Update prices in database
        const updates = [];
        for (const [coingeckoId, price] of Object.entries(prices)) {
            const investmentIds = idToInvestmentIds[coingeckoId];
            if (investmentIds && price > 0) {
                for (const investmentId of investmentIds) {
                    updates.push(
                        prisma.investment.update({
                            where: { id: investmentId },
                            data: { lastPrice: price }
                        })
                    );
                }
            }
        }

        await Promise.all(updates);

        return NextResponse.json({
            message: 'Prices updated successfully',
            cryptosChecked: cryptos.length,
            pricesFetched: Object.keys(prices).length,
            investmentsUpdated: updates.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in crypto price cron:', error);
        return NextResponse.json(
            {
                error: 'Failed to update prices',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
