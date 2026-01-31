
import { PrismaClient } from '@prisma/client';

// INLINED calculateXIRR to avoid import issues
function calculateXIRR(amounts: number[], dates: Date[]): number | null {
    if (!amounts || amounts.length < 2) return null;

    const hasPositive = amounts.some(a => a > 0);
    const hasNegative = amounts.some(a => a < 0);
    if (!hasPositive || !hasNegative) return null;

    const day0 = dates[0].getTime();
    const times = dates.map(d => (d.getTime() - day0) / (1000 * 3600 * 24));

    function npv(rate: number): number {
        let sum = 0;
        for (let i = 0; i < amounts.length; i++) {
            sum += amounts[i] / Math.pow(1 + rate, times[i] / 365);
        }
        return sum;
    }

    function derivativeNPV(rate: number): number {
        let sum = 0;
        for (let i = 0; i < amounts.length; i++) {
            sum += -(times[i] / 365) * amounts[i] / Math.pow(1 + rate, times[i] / 365 + 1);
        }
        return sum;
    }

    const guesses = [0.05, 0.1, 0.01, -0.1, 0.2];

    for (const guess of guesses) {
        let rate = guess;
        try {
            for (let iter = 0; iter < 200; iter++) {
                const f = npv(rate);
                const df = derivativeNPV(rate);
                if (Math.abs(df) < 1e-12) break;
                const newRate = rate - f / df;
                if (!isFinite(newRate)) break;
                if (Math.abs(newRate - rate) < 1e-9) {
                    rate = newRate;
                    break;
                }
                rate = newRate;
            }
            if (isFinite(rate) && Math.abs(npv(rate)) < 1e-4) {
                return Number(rate.toFixed(10));
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("🔍 Starting Verification of PDF Logic...");

        // 1. Get User (Specific)
        const user = await prisma.user.findUnique({
            where: { id: 'cmixpqcnk00003mnmljva12cg' },
            include: { appSettings: true }
        });
        if (!user) throw new Error("No user found");
        console.log(`👤 User: ${user.email} (${user.id})`);

        // ==========================================
        // PASTE LOGIC FROM page.tsx HERE
        // ==========================================

        // 0. Fetch Exchange Rates
        const allRates = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'desc' }
        });
        const latestExchangeRate = allRates[0]?.value || 1160;

        const getExchangeRate = (date: Date): number => {
            const rate = allRates.find(r => r.date <= date);
            if (rate) return rate.value;
            if (allRates.length > 0) return allRates[allRates.length - 1].value;
            return 1200;
        };

        // Fetch Investments
        // Emulate the "ARG" filter if that's what page.tsx does? 
        // page.tsx does NOT filter by market in the code I saw, but the route might?
        // Wait, page.tsx just does `prisma.investment.findMany({ where: { userId } })`.
        // The *Dashboard* filters by Market. 
        // Let's assume we want to match the Dashboard "Cartera Argentina" ($47k).
        // So we should filter by market optionally, or just verify the ONs.

        const investments = await prisma.investment.findMany({
            where: {
                userId: user.id,
                market: 'ARG' // Strict Match to Dashboard
            },
            include: {
                transactions: true, // { orderBy: { date: 'asc' } },
                cashflows: { orderBy: { date: 'asc' } },
                assetPrices: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        // Fetch Latest Asset Prices (Bulk)
        const invIds = investments.map(i => i.id);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const recentPrices = await prisma.assetPrice.findMany({
            where: { investmentId: { in: invIds }, date: { gte: weekAgo } },
            orderBy: { date: 'desc' }
        });

        const priceMap: Record<string, number> = {};
        recentPrices.forEach(p => {
            if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price;
        });

        const toNumber = (val: any) => Number(val) || 0;

        let totalValueUSD = 0;
        const tirAmounts: number[] = [];
        const tirDates: Date[] = [];

        console.log(`\n📋 Processing ${investments.length} investments...`);

        investments.forEach(inv => {
            if (inv.ticker === 'DNC5D') console.log(`\n--- Debugging DNC5D ---`);

            let quantity = 0;

            inv.transactions.forEach(t => {
                const qty = toNumber(t.quantity);
                const totalAmountIdx = toNumber(t.totalAmount);

                if (t.type === 'BUY') {
                    quantity += qty;
                    let amountUSD = -Math.abs(totalAmountIdx);
                    if (t.currency === 'ARS') {
                        const rate = getExchangeRate(t.date);
                        amountUSD = amountUSD / rate;
                    }
                    tirAmounts.push(amountUSD);
                    tirDates.push(t.date);

                } else if (t.type === 'SELL') {
                    quantity -= qty;
                    let amountUSD = Math.abs(totalAmountIdx);
                    if (t.currency === 'ARS') {
                        const rate = getExchangeRate(t.date);
                        amountUSD = amountUSD / rate;
                    }
                    tirAmounts.push(amountUSD);
                    tirDates.push(t.date);
                } else {
                    quantity += qty;
                }
            });

            // Smart Price Logic
            let rawPrice = priceMap[inv.id] !== undefined ? priceMap[inv.id] : toNumber(inv.lastPrice);
            if (inv.ticker === 'DNC5D') console.log(`Raw Price: ${rawPrice}`);

            if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && rawPrice > 2.0) {
                rawPrice = rawPrice / 100;
                if (inv.ticker === 'DNC5D') console.log(`Normalized /100: ${rawPrice}`);
            }

            let priceUSD = rawPrice;

            // Heuristic Fix Logic
            if (priceUSD > 50.0) {
                if (inv.ticker === 'DNC5D') console.log(`Triggered Conversion (Price > 50). Rate: ${latestExchangeRate}`);
                priceUSD = priceUSD / latestExchangeRate;
            } else {
                if (inv.ticker === 'DNC5D') console.log(`No Conversion (Price <= 50).`);
            }

            if (inv.ticker === 'DNC5D') console.log(`Final Price USD: ${priceUSD}`);

            const value = quantity * priceUSD;
            if (inv.ticker === 'DNC5D') console.log(`Quantity: ${quantity}, Value: ${value}`);

            if (value > 0) {
                totalValueUSD += value;
            }

            // Cashflows for TIR
            inv.cashflows.forEach(c => {
                let amount = toNumber(c.amount);
                const cfDate = c.date;
                const cfCurrency = c.currency || inv.currency;

                if (cfCurrency === 'ARS') {
                    const rate = cfDate <= new Date() ? getExchangeRate(cfDate) : latestExchangeRate;
                    if (rate > 0) amount = amount / rate;
                }

                tirAmounts.push(amount);
                tirDates.push(cfDate);
            });
        });

        // Add current value as final cashflow
        // if (totalValueUSD > 0) {
        //    tirAmounts.push(totalValueUSD);
        //    tirDates.push(new Date());
        // }

        const calculatedTIR = calculateXIRR(tirAmounts, tirDates);
        const yieldAPY = calculatedTIR ? calculatedTIR * 100 : 0;

        console.log("\n==================================");
        console.log(`💰 TOTAL VALUATION: $${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`📈 YIELD / TIR:     ${yieldAPY.toFixed(2)}%`);
        console.log("==================================");

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
