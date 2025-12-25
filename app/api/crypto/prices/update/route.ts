import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { getCryptoPrices } from '@/app/lib/coingecko';
import { findCryptoBySymbol } from '@/app/lib/crypto-list';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for this endpoint

/**
 * Update prices for all user's crypto holdings
 * Can be called manually or via cron
 */
export async function POST() {
    try {
        const userId = await getUserId();

        // Get all user's crypto investments
        const cryptos = await prisma.investment.findMany({
            where: {
                userId,
                type: 'CRYPTO',
                market: 'CRYPTO'
            },
            select: {
                id: true,
                ticker: true,
                name: true
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
        const tickerToId: Record<string, string> = {};
        const idToInvestmentId: Record<string, string> = {};

        for (const crypto of cryptos) {
            const cryptoInfo = findCryptoBySymbol(crypto.ticker);
            if (cryptoInfo) {
                coingeckoIds.push(cryptoInfo.coingeckoId);
                tickerToId[crypto.ticker] = cryptoInfo.coingeckoId;
                idToInvestmentId[cryptoInfo.coingeckoId] = crypto.id;
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
            const investmentId = idToInvestmentId[coingeckoId];
            if (investmentId && price > 0) {
                updates.push(
                    prisma.investment.update({
                        where: { id: investmentId },
                        data: { lastPrice: price }
                    })
                );
            }
        }

        await Promise.all(updates);

        return NextResponse.json({
            message: 'Prices updated successfully',
            updated: updates.length,
            prices
        });
    } catch (error) {
        console.error('Error updating crypto prices:', error);

        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            {
                error: 'Failed to update prices',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
