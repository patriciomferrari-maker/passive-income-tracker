import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';
import { calculateFIFO, FIFOTransaction, PositionEvent } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const typeParam = searchParams.get('type');
        const marketParam = searchParams.get('market');
        const targetCurrency = searchParams.get('currency'); // ARS or USD

        const typeFilter = typeParam ? {
            type: {
                in: typeParam.split(',')
            }
        } : {};

        const marketFilter = marketParam ? {
            market: marketParam
        } : {};

        // 1. Fetch all transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId,
                    ...typeFilter,
                    ...marketFilter
                },
            },
            include: {
                investment: true
            },
            orderBy: {
                date: 'asc'
            }
        });

        // 2. Fetch Exchange Rates (TC_USD_ARS)
        let ratesMap: Record<string, number> = {};
        if (targetCurrency) {
            const rates = await prisma.economicIndicator.findMany({
                where: { type: 'TC_USD_ARS' },
                select: { date: true, value: true }
            });
            rates.forEach(r => {
                const d = r.date.toISOString().split('T')[0];
                ratesMap[d] = r.value;
            });
        }

        const getRate = (date: Date) => {
            const dateStr = date.toISOString().split('T')[0];
            if (ratesMap[dateStr]) return ratesMap[dateStr];

            // Fallback: Find closest rate in past (simple linear scan in map keys if needed, but let's assume coverage)
            // If missing, try to find a rate within 7 days
            const targetTime = date.getTime();
            // This is slow if map is large, but acceptable for now. 
            // Better: finding the last known rate.
            // Since keys are YYYY-MM-DD, we can just look back day by day.
            let d = new Date(date);
            for (let i = 0; i < 10; i++) { // Look back 10 days
                const ds = d.toISOString().split('T')[0];
                if (ratesMap[ds]) return ratesMap[ds];
                d.setDate(d.getDate() - 1);
            }
            return 0;
        };

        // 3. Fetch Latest Asset Prices for Target Currency
        // We need the latest price for each investment in the TARGET currency.
        const investmentIds = Array.from(new Set(transactions.map(t => t.investmentId)));

        let priceMap: Record<string, number> = {}; // investmentId -> price

        if (targetCurrency && investmentIds.length > 0) {
            // Fetch latest price for each investment in the specific currency
            // We can't easily do "Find Latest Group By" in Prisma standard API without unique keys or raw query.
            // We'll fetch all prices for these investments from the last 7 days and pick the latest in memory.
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const recentPrices = await prisma.assetPrice.findMany({
                where: {
                    investmentId: { in: investmentIds },
                    currency: targetCurrency, // Strict currency match
                    date: { gte: weekAgo }
                },
                orderBy: { date: 'asc' }
            });

            // Populate map with latest (asc sort guarantees last is latest)
            recentPrices.forEach(p => {
                priceMap[p.investmentId] = p.price;
            });
        }


        // 4. Group transactions by Ticker
        const txByTicker: Record<string, FIFOTransaction[]> = {};
        const investmentMap: Record<string, any> = {};

        for (const tx of transactions) {
            const ticker = tx.investment.ticker;
            if (!txByTicker[ticker]) {
                txByTicker[ticker] = [];
                investmentMap[ticker] = tx.investment;
            }

            let price = tx.price;
            let commission = tx.commission;
            let currency = tx.currency;

            // HISTORICAL COST CONVERSION
            // "Las COMPRAS que se hicieron en USD --> Multiplicar esos valores por el TC AVG del dìa de la compra" (View ARS)
            // "Las compras que hice en ARS, dividir precio de compra y comision por el TC AVG" (View USD)

            if (targetCurrency && targetCurrency !== currency) {
                const rate = getRate(tx.date);
                if (rate > 0) {
                    if (currency === 'ARS' && targetCurrency === 'USD') {
                        // ARS -> USD
                        // We need to track the rate used.
                        // originalPrice is the ARS price.
                        // price is the converted USD price.
                        // But wait, the standard P&L Attribution requested is usually for USD assets viewed in ARS?
                        // "cuando la operacion estè en PESOS, agreguemos 4 columnas"
                        // This implies viewing in ARS.
                        // If the asset is natively USD (e.g. ONs in USD), and we view in ARS:
                        // We CONVERT USD -> ARS.
                        // So here: currency='USD', target='ARS'.
                        price = price * rate;
                        commission = commission * rate;
                        currency = 'ARS';
                    } else if (currency === 'USD' && targetCurrency === 'ARS') {
                        // USD -> ARS
                        price = price * rate;
                        commission = commission * rate;
                        currency = 'ARS';
                    }
                }
                // Pass the rate used for conversion if relevant for P&L attribution
                // If we are viewing in ARS, and the asset was bought in USD (or converted to ARS via rate),
                // we want to know the "Buy TC".
                // If original currency was USD, `rate` is the TC.
                // If original currency was ARS, and we view in ARS, rate is 1.
            }

            // Capture data for FIFO
            // For P&L Attribution (FX vs Price result), we focus on the case: View in ARS.
            // If we view in ARS:
            // 1. Transaction was in USD: Converted to ARS using `rate`. `rate` IS the "TC Compra".
            // 2. Transaction was in ARS: `rate` is 1 (or undefined).

            let exchangeRate = 1;
            let originalPrice = tx.price; // Default to transaction price

            if (targetCurrency === 'ARS' && tx.currency === 'USD') {
                // Convert USD tx to ARS inventory
                const rate = getRate(tx.date) || 1;
                exchangeRate = rate;
                originalPrice = tx.price; // Original USD price

                // Apply conversion for the FIFO inventory (Price in ARS)
                price = tx.price * rate;
                commission = tx.commission * rate;
                currency = 'ARS';
            } else if (targetCurrency === 'USD' && tx.currency === 'ARS') {
                // Convert ARS tx to USD inventory
                const rate = getRate(tx.date) || 1;
                exchangeRate = rate;
                originalPrice = tx.price; // Original ARS price

                // Apply conversion
                price = tx.price / rate;
                commission = tx.commission / rate;
                currency = 'USD';
            }

            txByTicker[ticker].push({
                id: tx.id,
                date: tx.date,
                type: tx.type as 'BUY' | 'SELL',
                quantity: tx.quantity,
                price: price,
                commission: commission,
                currency: currency,
                exchangeRate: exchangeRate,
                originalPrice: originalPrice
            });
        }

        // 5. Calculate Positions
        let allPositions: any[] = [];

        for (const ticker in txByTicker) {
            const result = calculateFIFO(txByTicker[ticker], ticker);
            const investment = investmentMap[ticker];

            // DETERMINE CURRENT MARKET PRICE
            let currentPrice = 0;
            let currentExchangeRate = 1; // Track TC Actual

            if (targetCurrency) {
                if (priceMap[investment.id]) {
                    currentPrice = priceMap[investment.id];
                }
                else {
                    const basePrice = investment.lastPrice || 0;
                    const baseCurrency = investment.currency || 'USD';

                    if (baseCurrency === targetCurrency) {
                        currentPrice = basePrice;
                    } else {
                        const rateDate = investment.lastPriceDate || new Date();
                        const rate = getRate(rateDate);
                        currentExchangeRate = rate; // Capture TC Actual if derived
                        if (rate > 0) {
                            if (baseCurrency === 'ARS' && targetCurrency === 'USD') currentPrice = basePrice / rate;
                            else if (baseCurrency === 'USD' && targetCurrency === 'ARS') currentPrice = basePrice * rate;
                        }
                    }
                }
            } else {
                currentPrice = investment.lastPrice || 0;
            }

            // If we found a strict price in ARS for a USD asset, we still need the Implied TC for the P&L formula?
            // "TC actual/venta".
            // If we scraped ARS price directly, we might not have the explicit TC.
            // Implied TC = Price ARS / Price USD.
            // We need Price USD to execute the formula: `Nominales x USD Price x (TC Current - TC Buy)`.
            // Wait, the user formula: `nominales x (TC actual/venta - TC Compra) - comisiones`.
            // This formula assumes the nominals ARE DOLLARS? Or that nominals * PriceUSD is the base?
            // "Nominales" usually refers to Quantity.
            // If I bought 100 units at $1 USD (TC 1000) -> Cost 100,000 ARS.
            // Now Price is $1 USD (TC 1200) -> Value 120,000 ARS.
            // FX Result = 120,000 - 100,000 = 20,000.
            // Formula check: 100 * (1200 - 1000) = 20,000. Correct.
            // This assumes Price USD remained constant ($1).
            // What if Price USD changed to $1.1?
            // Cost: 100,000 ARS.
            // Value: 100 * 1.1 * 1200 = 132,000 ARS.
            // Total Gain: 32,000.
            // FX Result should be? 
            // "Para ver el resultado por performance, vamos a hacer la cuenta que està ahora, pero neteandole el resultado por TC"
            // FX Result logic: Effect of TC change on the ORIGINAL investment? 
            // Logic A: Qty * OriginalUSDPrice * (CurrentTC - BuyTC).
            // In example: 100 * 1 * (1200 - 1000) = 20,000.
            // Price Result = Total (32,000) - FX (20,000) = 12,000.
            // 12,000 represents the gain from $1 -> $1.1 (10% gain).
            // 10% of 120,000 (Current Value)? No.
            // 10% of Cost in TC TERMS?
            // Let's stick to users formula: `nominales x (TC actual/venta - TC Compra)`.
            // BUT, user creates ambiguity: "nominales" for ONs might be Face Value? 
            // Let's assume `quantity * original_price_usd` is the "Principal in USD".
            // So formula: `(Quantity * OriginalPriceUSD) * (CurrentTC - BuyTC)`.

            // We need `currentExchangeRate`. 
            // If we scraped ARS price, do we have TC?
            // We can look up TC from `getRate(new Date())` or use Implied if we have USD price.
            // Let's use `getRate(new Date())` (TC Blue Actual) as the standard "Current TC".

            const currentTC = getRate(new Date());


            if (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') {
                currentPrice = currentPrice / 100;
            }

            // Map Realized
            const realizedEvents = result.realizedGains.map(g => {
                // FX Result for Realized?
                // Only if current view is ARS and we have data.
                let fxResult = 0;
                let priceResult = 0;

                if (targetCurrency === 'ARS' && g.buyExchangeRateAvg && g.buyExchangeRateAvg > 1) {
                    // Need "Sell TC".
                    // If transaction currency was USD, we have implicit Sell TC?
                    // Or we just use the historic TC of the sale date.
                    const sellTC = getRate(g.date);
                    const principalUSD = g.quantity * (g.buyPriceAvg / g.buyExchangeRateAvg);
                    // buyPriceAvg is ARS. Divide by TC to get USD Price Avg?
                    // Wait, `buyPriceAvg` in simplified logic above was calculated on the *converted* inventory?
                    // Yes. If we converted to ARS, `buyPriceAvg` is in ARS.
                    // So `buyPriceAvg / buyExchangeRateAvg` should be roughly `originalPriceUSD`.

                    const fxDiff = sellTC - g.buyExchangeRateAvg;
                    fxResult = principalUSD * fxDiff;
                    priceResult = g.gainAbs - fxResult;
                }


                return {
                    id: g.id,
                    date: g.date,
                    ticker: g.ticker,
                    name: investment.name,
                    status: g.status,
                    quantity: g.quantity,
                    buyPrice: g.buyPriceAvg,
                    buyCommission: g.buyCommissionPaid,
                    sellPrice: g.sellPrice,
                    sellCommission: g.sellCommission,
                    resultAbs: g.gainAbs,
                    resultPercent: g.gainPercent,
                    currency: g.currency,
                    currentPrice: 0,
                    unrealized: false,
                    fxResult,
                    priceResult
                };
            });

            // Map Open
            const openEvents = result.openPositions.map(p => {
                const totalCost = (p.quantity * p.buyPrice) + p.buyCommission;
                const currentValue = p.quantity * currentPrice;

                const resultAbs: number | null = currentPrice > 0 ? currentValue - totalCost : null;
                const resultPercent: number | null = currentPrice > 0 && totalCost !== 0 ? ((currentValue - totalCost) / totalCost) * 100 : null;

                let fxResult = 0;
                let priceResult = 0;

                if (targetCurrency === 'ARS' && p.buyExchangeRateAvg && p.buyExchangeRateAvg > 1 && resultAbs !== null) {
                    // Formula: (Qty * OriginalPriceUSD) * (CurrentTC - BuyTC)
                    // We need OriginalPriceUSD. 
                    // p.buyPrice is in ARS (converted). 
                    // p.buyPriceOriginalAvg is the Original Price (USD).

                    const originalPriceUSD = p.buyPriceOriginalAvg || (p.buyPrice / p.buyExchangeRateAvg);
                    const principalUSD = p.quantity * originalPriceUSD;

                    const fxDiff = currentTC - p.buyExchangeRateAvg;
                    fxResult = principalUSD * fxDiff;
                    // Adjust FX result for commission? "neteandole el resultado por TC".
                    // User said: "nominales x (TC actual/venta - TC Compra) - comisiones".
                    // Wait, comisiones usually are deducted from total result.
                    // If we define FX Result PURELY as the Rate Diff on Principal:
                    // Then Price Result absorbs the commissions?
                    // "neteandole el resultado por TC" -> Price Result = Total Result - FX Result.
                    // This implies Total Result (which includes commissions) - FX Result.
                    // So FX Result is Gross?
                    // User said: "Para ver el resultado por performance, vamos a hacer la cuenta que data ahora, pero neteandole el resultado por TC"
                    // So `PriceResult = ResultAbs - FXResult`.

                    priceResult = resultAbs - fxResult;
                }

                return {
                    id: p.id,
                    date: p.date,
                    ticker: p.ticker,
                    name: investment.name,
                    status: 'OPEN',
                    quantity: p.quantity,
                    buyPrice: p.buyPrice,
                    buyCommission: p.buyCommission,
                    sellPrice: currentPrice > 0 ? currentPrice : 0,
                    sellCommission: 0,
                    resultAbs: resultAbs ?? 0,
                    resultPercent: resultPercent ?? 0,
                    currency: targetCurrency || p.currency,
                    unrealized: true,
                    fxResult,
                    priceResult
                };
            });

            allPositions = [...allPositions, ...realizedEvents, ...openEvents];
        }

        allPositions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json(allPositions);
    } catch (error) {
        console.error('Error calculating positions:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
