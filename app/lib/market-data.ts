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
    // Import inside function to avoid init issues
    const YahooFinance = require('yahoo-finance2').default;
    const yahooFinance = new YahooFinance();

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

// Helper: Scrape Rava
export async function fetchRavaPrice(symbol: string): Promise<{ price: number; usdPrice?: number; updateDate?: Date } | null> {
    try {
        const url = `https://www.rava.com/perfil/${symbol}`;
        console.log(`Fetching Rava: ${url}`);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();

        const regex = /:res="([^"]+)"/;
        const match = html.match(regex);

        if (match) {
            const jsonStr = match[1].replace(/&quot;/g, '"');
            try {
                const data = JSON.parse(jsonStr);
                const hist = data.coti_hist;
                if (Array.isArray(hist) && hist.length > 0) {
                    const last = hist[hist.length - 1];
                    // last contains { cierre: number, fecha: string, usd_cierre: number, ... }
                    const price = last.cierre;
                    const usdPrice = last.usd_cierre || last.usd_ultimo || null;

                    const dateParts = last.fecha.split('-'); // YYYY-MM-DD
                    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));

                    return { price, usdPrice, updateDate: date };
                }
            } catch (e) {
                console.error(`Error parsing Rava JSON for ${symbol}:`, e);
            }
        }
    } catch (e: any) {
        console.error(`Rava Fetch Error (${symbol}):`, e.message);
    }
    return null;
}

// 2. Update Argentina Assets (ON, CEDEAR, ETF)
export async function updateONs(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];
    const YahooFinance = require('yahoo-finance2').default;
    const yahooFinance = new YahooFinance();

    console.log(`[updateONs] Called with userId: ${userId}`);
    // Find ONs/Cedears/ETFs
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            type: { in: ['ON', 'CEDEAR', 'ETF', 'CORPORATE_BOND'] },
            ...(userId ? { userId } : {})
        }
    });

    console.log(`[updateONs] Found ${investments.length} investments.`);

    if (investments.length === 0) {
        return [];
    }

    for (const inv of investments) {
        let price = null;
        let currency = inv.currency || 'ARS'; // Default to ARS if not set, or preserve existing
        let source: 'YAHOO' | 'IOL' | 'RAVA' = 'IOL';
        let error = undefined;

        // Determine strategy based on Type
        // CEDEAR/ETF -> Rava Preference
        // ON -> IOL Preference (as before)

        if (inv.type === 'CEDEAR' || inv.type === 'ETF') {
            source = 'RAVA';

            // For CEDEARs, we might want ARS price by default (ticker)
            // If the user wants USD, they might have a separate investment or we assume ARS for now.
            // Rava URL for ARS is just ticker (e.g. AAPL)

            // Try Rava
            const ravaData = await fetchRavaPrice(inv.ticker);
            if (ravaData) {
                price = ravaData.price;
                // Rava usually returns ARS for standard tickers.
                // If the user entered a ticker ending in D, it would be USD.
                if (inv.ticker.endsWith('D')) {
                    currency = 'USD';
                } else {
                    currency = 'ARS';
                }
            } else {
                // Fallback to IOL? or Yahoo?
                // Yahoo might be better for underlying US ETF but for CEDEAR price we need local market.
                // Try IOL as fallback
                const iolData = await fetchIOLPrice(inv.ticker);
                if (iolData) {
                    price = iolData.price;
                    currency = iolData.currency;
                    source = 'IOL';
                }
            }

        } else {
            // ON / CORPORATE_BOND -> Keep existing IOL logic

            // Force Ticker to end in 'D' for USD Price (User Request for ONs specifically?)
            // The previous logic forced 'D' for ONs. I should preserve that ONLY if it was intended for ONs.
            // The previous code applied it to *all* investments in this function. 
            // "Force Ticker to end in 'D' for USD Price (User Request)" -> likely for ONs which trade in USD commonly.

            let searchTicker = inv.ticker;
            // Only apply D suffix logic for ONs if that was the specific requirement, 
            // but standard ON tickers on IOL often need alignment.
            // I'll preserve the logic but check if it's generic.

            if (inv.type === 'ON' || inv.type === 'CORPORATE_BOND') {
                if (!searchTicker.endsWith('D') && searchTicker.length > 0) {
                    searchTicker = searchTicker.slice(0, -1) + 'D';
                }
            }

            // Strategy 1: IOL Scraping
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
        }

        if (price) {
            await savePrice(inv.id, price, currency || 'USD'); // Default USD was for ONs, maybe dangerous for CEDEARs? 
            // For CEDEARs we explicitly set currency in the block above.
            results.push({ ticker: inv.ticker, price, currency, source: source as any });
        } else {
            results.push({ ticker: inv.ticker, price: null, currency: null, error: 'Not found', source: source as any });
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
