
import axios from 'axios';

/**
 * Twelve Data API Client
 * Free Tier Limits: 8 requests per minute
 */
export class TwelveDataClient {
    private apiKey: string;
    private baseUrl = 'https://api.twelvedata.com';

    constructor() {
        this.apiKey = process.env.TWELVE_DATA_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️ TWELVE_DATA_API_KEY is not set. Twelve Data integration will not work.');
        }
    }

    /**
     * Fetches prices for a list of tickers using batching to respect rate limits.
     * @param tickers List of symbols (e.g. ['AAPL', 'TSLA'])
     * @returns Map of ticker -> price
     */
    async fetchBatchedPrices(tickers: string[]): Promise<Map<string, number>> {
        if (!this.apiKey) return new Map();

        const results = new Map<string, number>();
        const BATCH_SIZE = 8; // Free tier limit: 8 symbols per minute (effectively)
        const DELAY_MS = 61000; // 61 seconds to be safe

        // Chunk the tickers
        const chunks = [];
        for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
            chunks.push(tickers.slice(i, i + BATCH_SIZE));
        }

        console.log(`📊 Twelve Data: Processing ${tickers.length} symbols in ${chunks.length} batches...`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            if (i > 0) {
                console.log(`⏳ Waiting ${DELAY_MS / 1000}s before next batch to respect rate limits...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }

            console.log(`   Fetching batch ${i + 1}/${chunks.length}: ${chunk.join(', ')}`);

            try {
                // Determine format based on batch size
                // If 1 symbol, endpoint returns object. If multiple, it returns object with symbols as keys.
                const symbolsParam = chunk.join(',');
                const url = `${this.baseUrl}/price?symbol=${symbolsParam}&apikey=${this.apiKey}`;

                const response = await axios.get(url);
                const data = response.data;

                if (data.code && data.code !== 200) {
                    console.error(`❌ Twelve Data Error: ${data.message}`);
                    continue;
                }

                // Handle single symbol response (structure is different)
                if (chunk.length === 1) {
                    if (data.price) {
                        results.set(chunk[0], parseFloat(data.price));
                    }
                } else {
                    // Handle multi-symbol response
                    for (const symbol of chunk) {
                        if (data[symbol] && data[symbol].price) {
                            results.set(symbol, parseFloat(data[symbol].price));
                        } else if (data[symbol] && data[symbol].status === 'error') {
                            console.warn(`   ⚠️ Error for ${symbol}: ${data[symbol].message}`);
                        }
                    }
                }

            } catch (error: any) {
                console.error(`❌ Batch fetch error: ${error.message}`);
            }
        }

        return results;
    }
}
