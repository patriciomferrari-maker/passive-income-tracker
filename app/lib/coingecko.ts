// CoinGecko API Helper
// Free tier - no API key required for basic pricing

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

interface CoinGeckoPriceResponse {
    [key: string]: {
        usd: number;
    };
}

/**
 * Get current USD prices for multiple cryptocurrencies
 * @param coingeckoIds - Array of CoinGecko IDs (e.g., ['bitcoin', 'ethereum'])
 * @returns Record of coingeckoId -> USD price
 */
export async function getCryptoPrices(
    coingeckoIds: string[]
): Promise<Record<string, number>> {
    if (coingeckoIds.length === 0) return {};

    try {
        const ids = coingeckoIds.join(',');
        const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=usd`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoPriceResponse = await response.json();

        // Convert to simple Record<string, number>
        const prices: Record<string, number> = {};
        for (const [id, priceData] of Object.entries(data)) {
            prices[id] = priceData.usd;
        }

        return prices;
    } catch (error) {
        console.error('Error fetching crypto prices:', error);
        throw error;
    }
}

/**
 * Validate if a cryptocurrency symbol exists on CoinGecko
 * @param symbol - Crypto symbol (e.g., 'BTC')
 * @returns CoinGecko ID if valid, null otherwise
 */
export async function validateCryptoSymbol(
    symbol: string
): Promise<string | null> {
    try {
        const url = `${COINGECKO_BASE_URL}/search?query=${symbol}`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();

        // Look for exact symbol match
        const coin = data.coins?.find((c: any) =>
            c.symbol?.toLowerCase() === symbol.toLowerCase()
        );

        return coin?.id || null;
    } catch (error) {
        console.error('Error validating crypto symbol:', error);
        return null;
    }
}

/**
 * Get single crypto price by CoinGecko ID
 */
export async function getCryptoPrice(coingeckoId: string): Promise<number | null> {
    try {
        const prices = await getCryptoPrices([coingeckoId]);
        return prices[coingeckoId] || null;
    } catch (error) {
        return null;
    }
}
