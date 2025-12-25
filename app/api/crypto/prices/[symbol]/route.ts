import { NextResponse } from 'next/server';
import { getCryptoPrices } from '@/app/lib/coingecko';
import { findCryptoBySymbol } from '@/app/lib/crypto-list';

export const dynamic = 'force-dynamic';

/**
 * Get current price for a specific cryptocurrency
 * Used when creating new crypto investments
 */
export async function GET(
    request: Request,
    { params }: { params: { symbol: string } }
) {
    try {
        const { symbol } = params;

        // Look up CoinGecko ID from our predefined list
        const cryptoInfo = findCryptoBySymbol(symbol);

        if (!cryptoInfo) {
            return NextResponse.json(
                { error: 'Cryptocurrency not found in supported list' },
                { status: 404 }
            );
        }

        // Fetch current price
        const prices = await getCryptoPrices([cryptoInfo.coingeckoId]);
        const price = prices[cryptoInfo.coingeckoId];

        if (!price) {
            return NextResponse.json(
                { error: 'Price not available' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            symbol: cryptoInfo.symbol,
            name: cryptoInfo.name,
            coingeckoId: cryptoInfo.coingeckoId,
            price,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching crypto price:', error);
        return NextResponse.json(
            { error: 'Failed to fetch price' },
            { status: 500 }
        );
    }
}
