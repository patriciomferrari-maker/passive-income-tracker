
import { prisma } from '@/lib/prisma';

// Use require for robust backend compatibility with Next.js/Webpack
const yahooFinance = require('yahoo-finance2').default;

// Types
interface MarketDataResult {
    ticker: string;
    price: number | null;
    currency: string | null;
    error?: string;
}

interface IPCResult {
    date: Date;
    value: number;
    error?: string;
}

// 1. Fetch Asset Prices
export async function updateAssetPrices(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];

    // Find investments with Tickers
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            ...(userId ? { userId } : {})
        }
    });

    console.log(`Found ${investments.length} investments with tickers.`);

    for (const inv of investments) {
        try {
            // Yahoo Finance fetch
            const quote = await yahooFinance.quote(inv.ticker);

            if (quote && quote.regularMarketPrice) {
                const price = quote.regularMarketPrice;
                const currency = quote.currency || inv.currency;
                const date = new Date(); // Now

                // Update Investment (Current Price)
                await prisma.investment.update({
                    where: { id: inv.id },
                    data: {
                        lastPrice: price,
                        lastPriceDate: date
                    }
                });

                // Add to History (AssetPrice)
                // Check if we already have a price for today to avoid spamming
                const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const existing = await prisma.assetPrice.findFirst({
                    where: {
                        investmentId: inv.id,
                        date: { gte: todayStart }
                    }
                });

                if (!existing) {
                    await prisma.assetPrice.create({
                        data: {
                            investmentId: inv.id,
                            price: price,
                            currency: currency,
                            date: date
                        }
                    });
                }

                results.push({ ticker: inv.ticker, price, currency });
            } else {
                results.push({ ticker: inv.ticker, price: null, currency: null, error: 'No price found - Check Ticker' });
            }

        } catch (error: any) {
            console.error(`Error fetching ${inv.ticker}:`, error.message);
            // Handle specific "Not Found" error cleaner
            const msg = error.message.includes('404') ? 'Ticker not found' : error.message;
            results.push({ ticker: inv.ticker, price: null, currency: null, error: msg });
        }
    }

    return results;
}

// 2. Fetch IPC (Argentina)
export async function updateIPC(): Promise<IPCResult> {
    // Corrected Series ID and Parameters
    // 172.3_JL_TOTAL_12_M_15 = IPC Nacional - Nivel General (Base 2016)
    const seriesId = '172.3_JL_TOTAL_12_M_15';

    try {
        // Remove 'sort=desc' which sometimes causes issues if not supported on all endpoints, 
        // but 'last' parameter usually helps.
        // Official API: https://apis.datos.gob.ar/series/api/series?ids=...
        const url = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&format=json`;

        // Use a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const json = await res.json();
            // Data format: data: [ [ "2024-10-01", 3.2 ] ]  <-- Example
            if (json.data && json.data.length > 0) {
                // The API returns defaults to ASC usually, so we need to be careful.
                // If limit=1 without sort, it might give the oldest.
                // Let's try to get last 12 and pick the latest to be safe if sort is tricky.
                // Re-fetch with sort if possible.
                const urlWithSort = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&sort=desc&format=json`;
                const resSort = await fetch(urlWithSort);

                let dateStr, value;

                if (resSort.ok) {
                    const jsonSort = await resSort.json();
                    if (jsonSort.data && jsonSort.data.length > 0) {
                        [dateStr, value] = jsonSort.data[0];
                    }
                }

                // Fallback if sort failed
                if (!dateStr && json.data.length > 0) {
                    // Grab last one from the first list?
                    const last = json.data[json.data.length - 1];
                    [dateStr, value] = last;
                }

                if (dateStr && value !== undefined) {
                    const date = new Date(dateStr);
                    // Fix Timezone offset issue by forcing UTC date components or adding T12:00:00
                    const safeDate = new Date(`${dateStr}T12:00:00Z`); // Center of day
                    const monthDate = new Date(safeDate.getFullYear(), safeDate.getMonth(), 1);

                    // Save to DB
                    const existing = await prisma.economicIndicator.findFirst({
                        where: { type: 'IPC', date: monthDate }
                    });

                    if (existing) {
                        await prisma.economicIndicator.update({
                            where: { id: existing.id },
                            data: { value: value }
                        });
                    } else {
                        await prisma.economicIndicator.create({
                            data: { type: 'IPC', date: monthDate, value: value }
                        });
                    }

                    return { date: monthDate, value: value };
                }
            }
        }
        return { date: new Date(), value: 0, error: `API Error: ${res.status}` };
    } catch (e: any) {
        return { date: new Date(), value: 0, error: e.message };
    }
}
