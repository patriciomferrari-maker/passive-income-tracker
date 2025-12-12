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

            // Fallback: Find closest rate in past
            let d = new Date(date);
            for (let i = 0; i < 10; i++) { // Look back 10 days
                const ds = d.toISOString().split('T')[0];
                if (ratesMap[ds]) return ratesMap[ds];
                d.setDate(d.getDate() - 1);
            }
            return 0;
        };

        // 3. Fetch Latest Asset Prices for Target Currency
        const investmentIds = Array.from(new Set(transactions.map(t => t.investmentId)));
        let priceMap: Record<string, number> = {}; // investmentId -> price

        if (targetCurrency && investmentIds.length > 0) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const recentPrices = await prisma.assetPrice.findMany({
                where: {
                    investmentId: { in: investmentIds },
                    currency: targetCurrency,
                    date: { gte: weekAgo }
                },
                orderBy: { date: 'asc' }
            });

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
            if (targetCurrency && targetCurrency !== currency) {
                const rate = getRate(tx.date);
                if (rate > 0) {
                    if (currency === 'ARS' && targetCurrency === 'USD') {
                        price = price / rate;
                        commission = commission / rate;
                        currency = 'USD';
                    } else if (currency === 'USD' && targetCurrency === 'ARS') {
                        price = price * rate;
                        commission = commission * rate;
                        currency = 'ARS';
                    }
                }
            }

            // Capture data for P&L Attribution (specifically for ARS view)
            let exchangeRate = 1;
            let originalPrice = tx.price;

            if (targetCurrency === 'ARS' && tx.currency === 'USD') {
                const rate = getRate(tx.date) || 1;
                exchangeRate = rate;
                originalPrice = tx.price;
                price = tx.price * rate; // Cost in ARS
                commission = tx.commission * rate;
                currency = 'ARS';
            } else if (targetCurrency === 'USD' && tx.currency === 'ARS') {
                const rate = getRate(tx.date) || 1;
                exchangeRate = rate;
                originalPrice = tx.price;
                price = tx.price / rate; // Cost in USD
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
            // let currentExchangeRate = 1;

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
                        // currentExchangeRate = rate;
                        if (rate > 0) {
                            if (baseCurrency === 'ARS' && targetCurrency === 'USD') currentPrice = basePrice / rate;
                            else if (baseCurrency === 'USD' && targetCurrency === 'ARS') currentPrice = basePrice * rate;
                        }
                    }
                }
            } else {
                currentPrice = investment.lastPrice || 0;
            }

            const currentTC = getRate(new Date());

            if (investment.type === 'ON' || investment.type === 'CORPORATE_BOND') {
                currentPrice = currentPrice / 100;
            }

            // Map Realized
            const realizedEvents = result.realizedGains.map(g => {
                let fxResult = 0;
                let priceResult = 0;

                if (targetCurrency === 'ARS' && g.buyExchangeRateAvg && g.buyExchangeRateAvg > 1) {
                    const sellTC = getRate(g.date);
                    // Formula: Nominales * (TC Venta - TC Compra)
                    const fxDiff = sellTC - g.buyExchangeRateAvg;
                    fxResult = g.quantity * fxDiff;

                    // Performance Result = Total Result - FX Result
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
                    priceResult,
                    buyExchangeRate: g.buyExchangeRateAvg,
                    sellExchangeRate: getRate(g.date),
                    type: investment.type
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
                    // Formula: Nominales * (TC Actual - TC Compra)
                    const fxDiff = currentTC - p.buyExchangeRateAvg;
                    fxResult = p.quantity * fxDiff;

                    // Performance Result = Total Result - FX Result
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
                    priceResult,
                    buyExchangeRate: p.buyExchangeRateAvg,
                    sellExchangeRate: currentTC,
                    type: investment.type
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
