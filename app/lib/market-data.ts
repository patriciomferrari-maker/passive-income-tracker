
import { prisma } from '@/lib/prisma';

// Use require for robust backend compatibility with Next.js/Webpack
const yahooFinance = require('yahoo-finance2').default;

// Types
interface MarketDataResult {
    ticker: string;
    price: number | null;
    currency: string | null;
    error?: string;
    source: 'YAHOO' | 'IOL';
}

interface IPCResult {
    date: Date;
    value: number;
    error?: string;
}

// Helper: Scrape IOL
async function fetchIOLPrice(symbol: string): Promise<{ price: number; currency: string } | null> {
    try {
        const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${symbol}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();

        // Regex for Header Price: "- US$ 284.126,93" or "- $ 106.200,00"
        // The structure seems to be: <h1>Title...</h1> ... - $ 123
        // We look for the pattern "currency space number" after a dash
        // Safe regex: /-\s*(US\$|\$)\s*([\d\.,]+)/
        const regex = /-\s*(US\$|\$)\s*([\d\.,]+)/;
        const match = html.match(regex);

        if (match) {
            const rawCurrency = match[1]; // US$ or $
            const rawValue = match[2];    // 284.126,93

            const currency = rawCurrency === 'US$' ? 'USD' : 'ARS';
            // Parse Number: remove dots, replace comma with dot
            const price = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));

            return { price, currency };
        }
    } catch (e) {
        console.error(`IOL Fetch Error (${symbol}):`, e);
    }
    return null;
}

// 1. Update Treasuries (Yahoo Finance Only)
export async function updateTreasuries(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];

    // Find Treasuries/ETFs with Ticker
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            type: { in: ['TREASURY', 'ETF', 'STOCK'] }, // US Only
            ...(userId ? { userId } : {})
        }
    });

    for (const inv of investments) {
        try {
            const quote = await yahooFinance.quote(inv.ticker);
            if (quote && quote.regularMarketPrice) {
                const price = quote.regularMarketPrice;
                const currency = quote.currency || inv.currency;

                await savePrice(inv.id, price, currency);
                results.push({ ticker: inv.ticker, price, currency, source: 'YAHOO' });
            } else {
                results.push({ ticker: inv.ticker, price: null, currency: null, error: 'Not found on Yahoo', source: 'YAHOO' });
            }
        } catch (e: any) {
            results.push({ ticker: inv.ticker, price: null, currency: null, error: e.message, source: 'YAHOO' });
        }
    }
    return results;
}

// 2. Update ONs (Try Yahoo, Fallback to IOL)
export async function updateONs(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];

    // Find ONs/Cedears
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            type: { in: ['ON', 'CEDEAR'] },
            ...(userId ? { userId } : {})
        }
    });

    for (const inv of investments) {
        let price = null;
        let currency = null;
        let source: 'YAHOO' | 'IOL' = 'YAHOO';
        let error = '';

        // Strategy 1: Yahoo Finance (Check if ends in .BA?)
        try {
            const quote = await yahooFinance.quote(inv.ticker);
            // Validation: Ensure valid volume or recent time? 
            // Often Yahoo returns old data for some ONs. Let's trust it for now.
            if (quote && quote.regularMarketPrice) {
                price = quote.regularMarketPrice;
                currency = quote.currency || inv.currency;
            }
        } catch (e) { /* Ignore Yahoo failure, try IOL */ }

        // Strategy 2: IOL (Scraping) if Yahoo failed
        if (!price) {
            source = 'IOL';
            // Remove .BA suffix for IOL
            const symbol = inv.ticker.replace('.BA', '');
            const iolData = await fetchIOLPrice(symbol);
            if (iolData) {
                price = iolData.price;
                currency = iolData.currency;
            } else {
                error = 'Not found on Yahoo or IOL';
            }
        }

        if (price) {
            await savePrice(inv.id, price, currency || 'USD');
            results.push({ ticker: inv.ticker, price, currency, source });
        } else {
            results.push({ ticker: inv.ticker, price: null, currency: null, error, source });
        }
    }
    return results;
}

// Helper to save to DB
async function savePrice(investmentId: string, price: number, currency: string) {
    const date = new Date();
    await prisma.investment.update({
        where: { id: investmentId },
        data: { lastPrice: price, lastPriceDate: date }
    });

    // History (Once a day)
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const existing = await prisma.assetPrice.findFirst({ where: { investmentId, date: { gte: todayStart } } });

    if (!existing) {
        await prisma.assetPrice.create({
            data: { investmentId, price, currency, date }
        });
    }
}

// 3. Fetch IPC (Existing logic)
export async function updateIPC(): Promise<IPCResult> {
    const seriesId = '172.3_JL_TOTAL_12_M_15';
    try {
        const url = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                // Try sort logic or grab last
                const urlWithSort = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&sort=desc&format=json`;
                const resSort = await fetch(urlWithSort);
                let dateStr, value;
                if (resSort.ok) {
                    const jsonSort = await resSort.json();
                    if (jsonSort.data && jsonSort.data.length > 0) [dateStr, value] = jsonSort.data[0];
                }
                if (!dateStr && json.data.length > 0) {
                    const last = json.data[json.data.length - 1];
                    [dateStr, value] = last;
                }

                if (dateStr && value !== undefined) {
                    const date = new Date(dateStr);
                    const safeDate = new Date(`${dateStr}T12:00:00Z`);
                    const monthDate = new Date(safeDate.getFullYear(), safeDate.getMonth(), 1);

                    const existing = await prisma.economicIndicator.findFirst({ where: { type: 'IPC', date: monthDate } });
                    if (existing) await prisma.economicIndicator.update({ where: { id: existing.id }, data: { value: value } });
                    else await prisma.economicIndicator.create({ data: { type: 'IPC', date: monthDate, value: value } });

                    return { date: monthDate, value: value };
                }
            }
        }
        return { date: new Date(), value: 0, error: `API Error: ${res.status}` };
    } catch (e: any) {
        return { date: new Date(), value: 0, error: e.message };
    }
}
