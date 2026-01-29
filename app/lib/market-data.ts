import { prisma } from '@/lib/prisma';
// import yahooFinance from 'yahoo-finance2';
import { TwelveDataClient } from '@/lib/utils/twelve-data';

// Types
interface MarketDataResult {
    ticker: string;
    price: number | null;
    currency: string | null;
    error?: string;
    source: 'YAHOO' | 'IOL' | 'RAVA' | 'TWELVE_DATA';
}

interface IPCResult {
    date: Date;
    value: number;
    error?: string;
}

// Helper: Scrape IOL
export async function fetchIOLPrice(symbol: string): Promise<{ price: number; currency: string } | null> {
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

            let currency = 'ARS'; // Default to ARS for ARG market (unless 'D' or clearly USD)

            // Check Moneda field if exists
            const regexMoneda = /data-field="Moneda">([^<]*)</;
            const matchMoneda = html.match(regexMoneda);
            const monedaText = matchMoneda ? matchMoneda[1].trim() : '';

            if (monedaText.includes('US$') || monedaText.includes('USD')) {
                currency = 'USD';
            } else if (monedaText.includes('$')) {
                currency = 'ARS';
            } else {
                // Fallback: Check context around UltimoPrecio (look for $ or US$)
                const context = html.substring(Math.max(0, matchDataVal.index! - 100), Math.min(html.length, matchDataVal.index! + 100));
                if (context.includes('US$') || context.includes('U$S')) {
                    currency = 'USD';
                } else if (context.includes('$')) {
                    currency = 'ARS';
                } else if (symbol.endsWith('D')) {
                    currency = 'USD';
                }
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

// Helper to save to DB
async function savePrice(investmentId: string, price: number, currency: string, updateMain: boolean = false) {
    const date = new Date();
    // console.log(`Saving price for ${investmentId}: ${price} ${currency}`);

    // Update main investment ONLY if requested (usually if currency matches primary)
    if (updateMain) {
        await prisma.investment.update({
            where: { id: investmentId },
            data: { lastPrice: price, lastPriceDate: date }
        });
    }

    // History (Once a day per currency)
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Check for existing price TODAY for THIS CURRENCY
    const existing = await prisma.assetPrice.findFirst({
        where: {
            investmentId,
            date: { gte: todayStart },
            currency: currency
        }
    });

    if (existing) {
        await prisma.assetPrice.update({
            where: { id: existing.id },
            data: { price, date } // Update timestamp and value
        });
    } else {
        await prisma.assetPrice.create({
            data: { investmentId, price, currency, date }
        });
    }
}

// Update Global Assets (New Catalog System)
export async function updateGlobalAssets(): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];
    const yahooFinance = (await import('yahoo-finance2')).default;

    // Helper to add delay between requests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Fetch US Assets (ETFs, Treasuries, Stocks)
    const usAssets = await prisma.globalAsset.findMany({
        where: { market: 'US' }
    });

    console.log(`Updating ${usAssets.length} US Global Assets...`);

    // Try Twelve Data first if API key is present
    const twelveDataClient = new TwelveDataClient();
    let twelveDataPrices = new Map<string, number>();

    // Only attempt Twelve Data if we have a key
    if (process.env.TWELVE_DATA_API_KEY) {
        const tickers = usAssets.map(a => a.ticker);
        try {
            twelveDataPrices = await twelveDataClient.fetchBatchedPrices(tickers);
        } catch (e) {
            console.error('Twelve Data Batch Error:', e);
        }
    }

    for (let i = 0; i < usAssets.length; i++) {
        const asset = usAssets[i];
        let price = twelveDataPrices.get(asset.ticker);
        let source: 'TWELVE_DATA' | 'YAHOO' = 'TWELVE_DATA';

        // Fallback to Yahoo if Twelve Data missed this ticker
        if (!price) {
            source = 'YAHOO';
            // Add delay between Yahoo requests to avoid rate limiting (except for first request)
            if (i > 0) {
                await delay(2000);
            }

            try {
                const quote = await yahooFinance.quote(asset.ticker);
                if (quote && quote.regularMarketPrice) {
                    price = quote.regularMarketPrice;
                }
            } catch (e: any) {
                console.error(`  ✗ ${asset.ticker}: ${e.message}`);
                results.push({
                    ticker: asset.ticker,
                    price: null,
                    currency: null,
                    error: e.message,
                    source: 'YAHOO'
                });
                continue;
            }
        }

        if (price) {
            await prisma.globalAsset.update({
                where: { id: asset.id },
                data: {
                    lastPrice: price,
                    lastPriceDate: new Date()
                }
            });
            results.push({
                ticker: asset.ticker,
                price: price,
                currency: 'USD', // Assumption for US market
                source: source
            });
            console.log(`  ✓ ${asset.ticker}: $${price} (${source})`);
        } else {
            results.push({
                ticker: asset.ticker,
                price: null,
                currency: null,
                error: 'Not found on Twelve Data or Yahoo',
                source: 'YAHOO'
            });
            console.log(`  ✗ ${asset.ticker}: No price found`);
        }
    }

    // 2. Fetch ARG Assets (CEDEARs)
    const argAssets = await prisma.globalAsset.findMany({
        where: { market: 'ARG', type: 'CEDEAR' }
    });

    console.log(`Updating ${argAssets.length} ARG Global Assets...`);
    for (const asset of argAssets) {
        // Use Rava for CEDEARs (same logic as updateONs)
        const ravaData = await fetchRavaPrice(asset.ticker);
        if (ravaData && ravaData.price) {
            await prisma.globalAsset.update({
                where: { id: asset.id },
                data: {
                    lastPrice: ravaData.price,
                    lastPriceDate: new Date()
                }
            });
            results.push({
                ticker: asset.ticker,
                price: ravaData.price,
                currency: 'ARS',
                source: 'RAVA'
            });
        } else {
            // Fallback to IOL
            const iolData = await fetchIOLPrice(asset.ticker);
            if (iolData) {
                await prisma.globalAsset.update({
                    where: { id: asset.id },
                    data: {
                        lastPrice: iolData.price,
                        lastPriceDate: new Date()
                    }
                });
                results.push({
                    ticker: asset.ticker,
                    price: iolData.price,
                    currency: iolData.currency,
                    source: 'IOL'
                });
            } else {
                results.push({
                    ticker: asset.ticker,
                    price: null,
                    currency: null,
                    error: 'Not found',
                    source: 'RAVA'
                });
            }
        }
    }

    return results;
}

// 1. Update Treasuries & US Stocks (US Market - Twelve Data Priority)
export async function updateTreasuries(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];
    const yahooFinance = (await import('yahoo-finance2')).default;

    // Find Treasuries/ETFs/Stocks with Ticker
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            type: { in: ['TREASURY', 'ETF', 'STOCK'] }, // US Only
            ...(userId ? { userId } : {})
        }
    });

    if (investments.length === 0) return [];

    console.log(`Updating ${investments.length} US Investments (User Holdings)...`);

    // --- TWELVE DATA BATCH FETCHING ---
    const twelveDataClient = new TwelveDataClient();
    let twelveDataPrices = new Map<string, number>();

    if (process.env.TWELVE_DATA_API_KEY) {
        // Unique tickers to fetch
        const uniqueTickers = Array.from(new Set(investments.map(i => i.ticker)));
        try {
            twelveDataPrices = await twelveDataClient.fetchBatchedPrices(uniqueTickers);
        } catch (e) {
            console.error('Twelve Data Batch Error (Investments):', e);
        }
    }

    // Helper to add delay between Yahoo requests (fallback only)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < investments.length; i++) {
        const inv = investments[i];
        let price = twelveDataPrices.get(inv.ticker);
        let source: 'TWELVE_DATA' | 'YAHOO' = 'TWELVE_DATA';

        // Fallback to Yahoo
        if (!price) {
            source = 'YAHOO';
            if (i > 0) await delay(1000); // Mild delay for Yahoo fallback

            try {
                const quote = await yahooFinance.quote(inv.ticker);
                if (quote && quote.regularMarketPrice) {
                    price = quote.regularMarketPrice;
                }
            } catch (e: any) {
                console.error(`  ✗ ${inv.ticker}: ${e.message}`);
                results.push({ ticker: inv.ticker, price: null, currency: null, error: e.message || 'Yahoo Error', source: 'YAHOO' });
                continue;
            }
        }

        if (price) {
            const currency = inv.currency; // Keep investment currency (usually USD)
            await savePrice(inv.id, price, currency, true);
            results.push({ ticker: inv.ticker, price, currency, source: source });
            console.log(`  ✓ ${inv.ticker}: $${price} (${source})`);
        } else {
            results.push({ ticker: inv.ticker, price: null, currency: null, error: 'Not found', source: source });
        }
    }
    return results;
}

// 2. Update Argentina Assets (ON, CEDEAR) - Exclude ETF (now handled by updateTreasuries via Yahoo if US)
export async function updateONs(userId?: string): Promise<MarketDataResult[]> {
    const results: MarketDataResult[] = [];
    const yahooFinance = (await import('yahoo-finance2')).default;

    // Find ONs/Cedears ONLY.
    const investments = await prisma.investment.findMany({
        where: {
            ticker: { not: '' },
            type: { in: ['ON', 'CEDEAR', 'CORPORATE_BOND'] },
            ...(userId ? { userId } : {})
        }
    });

    if (investments.length === 0) {
        return [];
    }

    for (const inv of investments) {
        let price = null;
        let currency = inv.currency || 'ARS';
        let source: 'YAHOO' | 'IOL' | 'RAVA' = 'IOL';

        // Strategy A: CEDEAR -> Rava (Try both Base and D suffix)
        if (inv.type === 'CEDEAR') {
            source = 'RAVA';

            // 1. Fetch ARS (Base)
            let ravaData = await fetchRavaPrice(inv.ticker);

            // If Rava Base failed or returned no price, try IOL Base
            if (!ravaData || !ravaData.price) {
                const iolData = await fetchIOLPrice(inv.ticker);
                if (iolData) {
                    await savePrice(inv.id, iolData.price, iolData.currency, true);
                    results.push({ ticker: inv.ticker, price: iolData.price, currency: iolData.currency, source: 'IOL' });
                } else {
                    results.push({ ticker: inv.ticker, price: null, currency: null, error: 'Not found', source: 'RAVA' });
                }
            } else {
                // Save ARS Price (Base)
                await savePrice(inv.id, ravaData.price, 'ARS', inv.currency === 'ARS');
                results.push({ ticker: inv.ticker, price: ravaData.price, currency: 'ARS', source: 'RAVA' });

                // If Rava gave us USD price in the same payload, save it
                if (ravaData.usdPrice) {
                    await savePrice(inv.id, ravaData.usdPrice, 'USD', inv.currency === 'USD');
                }
            }

            // 2. Fetch USD explicitly (Suffix 'D') if not already found or just to be sure
            // Many Rava CEDEARs store USD price in the 'D' ticker page
            const tickerD = inv.ticker + 'D';
            const ravaDataD = await fetchRavaPrice(tickerD);
            if (ravaDataD && ravaDataD.price) {
                await savePrice(inv.id, ravaDataD.price, 'USD', inv.currency === 'USD');
                // We don't necessarily push result for 'D' as it's the same asset, but good for debug
            } else {
                // Fallback to IOL for D if Rava D failed
                const iolDataD = await fetchIOLPrice(tickerD);
                if (iolDataD) {
                    await savePrice(inv.id, iolDataD.price, 'USD', inv.currency === 'USD');
                }
            }
        }

        // Strategy B: ON / Corporate Bond -> IOL (Dual Scraping)
        else {
            source = 'IOL';
            let baseTicker = inv.ticker.trim().toUpperCase();

            // Normalize base ticker (remove suffix for logic)
            if (baseTicker.endsWith('D') || baseTicker.endsWith('O') || baseTicker.endsWith('C')) {
                baseTicker = baseTicker.slice(0, -1);
            }

            // 1. Fetch ARS Price (Try 'O' suffix first as it's cleaner for ONs)
            const tickerARS = baseTicker + 'O';
            let iolDataARS = await fetchIOLPrice(tickerARS);

            // If 'O' failed, try base ticker (some don't use suffix)
            if (!iolDataARS) {
                const iolDataBase = await fetchIOLPrice(baseTicker);
                if (iolDataBase && iolDataBase.currency === 'ARS') {
                    iolDataARS = iolDataBase;
                }
            }

            if (iolDataARS) {
                await savePrice(inv.id, iolDataARS.price, 'ARS', inv.currency === 'ARS');
                results.push({ ticker: tickerARS, price: iolDataARS.price, currency: 'ARS', source: 'IOL' });
            }

            // 2. Fetch USD Price (Suffix 'D')
            const tickerUSD = baseTicker + 'D';
            const iolDataUSD = await fetchIOLPrice(tickerUSD);

            if (iolDataUSD) {
                await savePrice(inv.id, iolDataUSD.price, 'USD', inv.currency === 'USD');
                results.push({ ticker: tickerUSD, price: iolDataUSD.price, currency: 'USD', source: 'IOL' });
            } else {
                // Fallback to Yahoo for USD if IOL fails (rare for ONs but possible for Globals)
                try {
                    const quote = await yahooFinance.quote(tickerUSD);
                    if (quote && quote.regularMarketPrice) {
                        await savePrice(inv.id, quote.regularMarketPrice, quote.currency || 'USD', inv.currency === 'USD');
                    }
                } catch (e) { }
            }
        }
    }
    return results;
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

// Helper: Get Latest Prices for a list of tickers
export async function getLatestPrices(tickers: string[]): Promise<{ ticker: string; price: number; currency: string; date: Date }[]> {
    if (tickers.length === 0) return [];

    const prices: { ticker: string; price: number; currency: string; date: Date }[] = [];

    await Promise.all(tickers.map(async (ticker) => {
        // Use 'contains' or exact match? Exact is better.
        // findFirst on assetPrice with investment.ticker
        const lastPrice = await prisma.assetPrice.findFirst({
            where: {
                investment: { ticker: ticker }
            },
            orderBy: { date: 'desc' },
            take: 1
        });

        if (lastPrice) {
            prices.push({
                ticker,
                price: lastPrice.price,
                currency: lastPrice.currency,
                date: lastPrice.date
            });
        }
    }));

    return prices;
}

// Optimization: Update ONLY Active Assets (Investments + UserHoldings > 0)
export async function updateActiveAssetsOnly(): Promise<{ count: number; results: MarketDataResult[] }> {
    const results: MarketDataResult[] = [];
    console.log('🚀 Starting Optimized Asset Update (Active Only)...');

    // 1. Get Active Investments (Legacy System)
    const investments = await prisma.investment.findMany({
        where: { ticker: { not: '' } }
    });

    // 2. Get Active User Holdings (Global Catalog System)
    const holdings = await prisma.userHolding.findMany({
        where: {
            asset: { ticker: { not: '' } },
            transactions: { some: {} } // Heuristic: has transactions usually implies quantity > 0 or history.
        },
        include: { asset: true }
    });

    // 3. Merge Tickers & Determine Market
    const tickersMap = new Map<string, { market: string; type: string; id?: string; globalId?: string }>();

    investments.forEach(inv => {
        tickersMap.set(inv.ticker, { market: inv.market || 'US', type: inv.type, id: inv.id });
    });

    holdings.forEach(h => {
        // Prefer GlobalAsset properties
        tickersMap.set(h.asset.ticker, { market: h.asset.market || 'ARG', type: h.asset.type, globalId: h.asset.id });
    });

    const activeTickers = Array.from(tickersMap.keys());
    console.log(`Found ${activeTickers.length} active unique tickers.`);

    // 4. Split by Market
    const usTickers: string[] = [];
    const argTickers: string[] = [];

    activeTickers.forEach(t => {
        const data = tickersMap.get(t);
        if (data?.market === 'US') usTickers.push(t);
        else argTickers.push(t);
    });

    // 5. Update US Assets (Twelve Data Batch)
    if (usTickers.length > 0) {
        console.log(`Updating ${usTickers.length} US Assets via Twelve Data...`);
        const twelveDataClient = new TwelveDataClient();
        let prices = new Map<string, number>();

        if (process.env.TWELVE_DATA_API_KEY) {
            try {
                prices = await twelveDataClient.fetchBatchedPrices(usTickers);
            } catch (e) {
                console.error('TD Batch Error:', e);
            }
        }

        // Save prices
        for (const ticker of usTickers) {
            const price = prices.get(ticker);
            const meta = tickersMap.get(ticker);

            if (price && meta) {
                // Update Investment (if exists)
                if (meta.id) await savePrice(meta.id, price, 'USD', true);

                // Update GlobalAsset (if exists)
                if (meta.globalId) {
                    await prisma.globalAsset.update({
                        where: { id: meta.globalId },
                        data: { lastPrice: price, lastPriceDate: new Date() }
                    });
                }
                results.push({ ticker, price, currency: 'USD', source: 'TWELVE_DATA' });
            }
        }
    }

    // 6. Update ARG Assets (Rava/IOL)
    if (argTickers.length > 0) {
        console.log(`Updating ${argTickers.length} ARG Assets...`);
        for (const ticker of argTickers) {
            const meta = tickersMap.get(ticker);
            const rava = await fetchRavaPrice(ticker);
            let price = rava?.price;
            let currency = 'ARS';
            let source: any = 'RAVA';

            if (!price) {
                const iol = await fetchIOLPrice(ticker);
                if (iol) {
                    price = iol.price;
                    currency = iol.currency;
                    source = 'IOL';
                }
            }

            if (price && meta) {
                if (meta.id) await savePrice(meta.id, price, currency, meta.type === 'ON' || meta.type === 'CEDEAR');
                if (meta.globalId) {
                    await prisma.globalAsset.update({
                        where: { id: meta.globalId },
                        data: { lastPrice: price, lastPriceDate: new Date() }
                    });
                }
                results.push({ ticker, price, currency, source });
            }
        }
    }

    return { count: results.length, results };
}
