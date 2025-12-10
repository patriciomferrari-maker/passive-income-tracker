import { prisma } from '@/lib/prisma';

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
        // Remove .BA if present for IOL URL
        const cleanSymbol = symbol.replace('.BA', '');
        const url = `https://iol.invertironline.com/titulo/cotizacion/BCBA/${cleanSymbol}`;

        console.log(`Fetching IOL: ${url}`);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();

        // 1. Try "UltimoPrecio" data field
        const regexDataField = /data-field="UltimoPrecio">([\d\.,]+)</;
        const matchDataVal = html.match(regexDataField);

        if (matchDataVal) {
            const rawValue = matchDataVal[1];
            const price = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));

            let currency = 'USD'; // Default assumption
            if (html.includes('data-field="Moneda">US$') || html.includes('data-field="Moneda">USD') || html.includes('U$S')) {
                currency = 'USD';
            } else if (html.includes('data-field="Moneda">$')) {
                currency = 'ARS';
            }

            return { price, currency };
        }

        // 2. Fallback: Old Header Regex
        const regex = /-\s*(US\$|\$)\s*([\d\.,]+)/;
        const match = html.match(regex);

        if (match) {
            const rawCurrency = match[1];
            const rawValue = match[2];

            const currency = rawCurrency === 'US$' ? 'USD' : 'ARS';
            const price = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));

            return { price, currency };
        }
    } catch (e: any) {
        console.error(`IOL Fetch Error (${symbol}):`, e.message);
    }
    return null;
}

// 1. Update Treasuries (Yahoo Finance Only)
export async function updateTreasuries(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];

    // Import inside function to avoid init issues
    const yahooFinance = require('yahoo-finance2').default;

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
            console.error('Yahoo Error:', e);
            results.push({ ticker: inv.ticker, price: null, currency: null, error: e.message || 'Yahoo Error', source: 'YAHOO' });
        }
    }
    return results;
}

// 2. Update ONs (IOL Priority)
export async function updateONs(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];
    const yahooFinance = require('yahoo-finance2').default;

    console.log(`[updateONs] Called with userId: ${userId}`);
    // Find ONs/Cedears
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            type: { in: ['ON', 'CEDEAR'] },
            ...(userId ? { userId } : {})
        }
    });

    console.log(`[updateONs] Found ${investments.length} investments.`);

    if (investments.length === 0) {
        return [];
    }

    for (const inv of investments) {
        let price = null;
        let currency = null;
        let source: 'YAHOO' | 'IOL' = 'IOL';

        // Force Ticker to end in 'D' for USD Price (User Request)
        let searchTicker = inv.ticker;
        if (!searchTicker.endsWith('D') && searchTicker.length > 0) {
            searchTicker = searchTicker.slice(0, -1) + 'D';
        }

        // Strategy 1: IOL Scraping (Primary request)
        const iolData = await fetchIOLPrice(searchTicker);
        if (iolData) {
            price = iolData.price;
            currency = iolData.currency;
        }

        // Strategy 2: Yahoo Finance (Fallback)
        if (!price) {
            try {
                source = 'YAHOO';
                const quote = await yahooFinance.quote(searchTicker);
                if (quote && quote.regularMarketPrice) {
                    price = quote.regularMarketPrice;
                    currency = quote.currency || inv.currency;
                }
            } catch (e) { /* Ignore */ }
        }

        if (price) {
            await savePrice(inv.id, price, currency || 'USD');
            results.push({ ticker: inv.ticker, price, currency, source });
        } else {
            results.push({ ticker: inv.ticker, price: null, currency: null, error: 'Not found via IOL or Yahoo', source });
        }
    }
    return results;
}

// Helper to save to DB
async function savePrice(investmentId: string, price: number, currency: string) {
    const date = new Date();
    console.log(`Saving price for ${investmentId}: ${price} ${currency}`);
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

// 3. Update IPC
export async function updateIPC(): Promise<IPCResult> {
    const seriesId = '172.3_JL_TOTAL_12_M_15';
    try {
        const url = `https://apis.datos.gob.ar/series/api/series?ids=${seriesId}&limit=1&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                const last = json.data[json.data.length - 1];
                const [dateStr, value] = last;

                if (dateStr && value !== undefined) {
                    const dateKey = new Date(dateStr);
                    const monthDate = new Date(dateKey.getFullYear(), dateKey.getMonth(), 1);

                    const existing = await prisma.economicIndicator.findFirst({ where: { type: 'IPC', date: monthDate } });
                    if (existing) {
                        await prisma.economicIndicator.update({ where: { id: existing.id }, data: { value } });
                    } else {
                        await prisma.economicIndicator.create({ data: { type: 'IPC', date: monthDate, value } });
                    }
                    return { date: monthDate, value };
                }
            }
        }
        return { date: new Date(), value: 0, error: 'API Empty Response' };
    } catch (e: any) {
        return { date: new Date(), value: 0, error: e.message };
    }
}
