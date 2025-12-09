
import yahooFinance from 'yahoo-finance2';
import { prisma } from '@/lib/prisma';

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
            // We use 'any' cast because the return type is strict and sometimes misses fields
            const quote = await yahooFinance.quote(inv.ticker) as any;

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
                results.push({ ticker: inv.ticker, price: null, currency: null, error: 'No price found' });
            }

        } catch (error: any) {
            console.error(`Error fetching ${inv.ticker}:`, error.message);
            results.push({ ticker: inv.ticker, price: null, currency: null, error: error.message });
        }
    }

    return results;
}

// 2. Fetch IPC (Argentina)
export async function updateIPC(): Promise<IPCResult> {
    const seriesId = '148.3_INIVELNAL_Dici_M_26'; // IPC Nacional (Base 2016)
    // Alternative: 172.3_JL_TOTAL_12_M_15

    try {
        const url = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&sort=desc&format=json`;
        const res = await fetch(url);

        if (res.ok) {
            const json = await res.json();
            // Data format: [[date_str, value], ...]
            if (json.data && json.data.length > 0) {
                const [dateStr, value] = json.data[0];
                const date = new Date(dateStr);

                // Save to DB
                // Start of month to normalize
                const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);

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
        return { date: new Date(), value: 0, error: `API Error: ${res.status}` };
    } catch (e: any) {
        return { date: new Date(), value: 0, error: e.message };
    }
}
