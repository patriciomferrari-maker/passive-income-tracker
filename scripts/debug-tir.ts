
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Custom implementation from lib/financial.ts
function calculateXIRR(amounts: number[], dates: Date[]): number | null {
    if (!amounts || amounts.length < 2) return null;

    const hasPositive = amounts.some(a => a > 0);
    const hasNegative = amounts.some(a => a < 0);
    if (!hasPositive || !hasNegative) return null;

    const day0 = dates[0].getTime();
    const times = dates.map(d => (d.getTime() - day0) / (1000 * 3600 * 24));

    // Net Present Value function
    function npv(rate: number): number {
        let sum = 0;
        for (let i = 0; i < amounts.length; i++) {
            sum += amounts[i] / Math.pow(1 + rate, times[i] / 365);
        }
        return sum;
    }

    // Derivative of NPV
    function derivativeNPV(rate: number): number {
        let sum = 0;
        for (let i = 0; i < amounts.length; i++) {
            sum += -(times[i] / 365) * amounts[i] / Math.pow(1 + rate, times[i] / 365 + 1);
        }
        return sum;
    }

    // Try different initial guesses
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

// Mock getExchangeRate
let rates: any[] = [];
const getExchangeRate = (date: Date): number => {
    // Basic logic matching route.ts
    // Find closest previous date
    const dTime = date.getTime();
    // Assuming rates sorted DESC
    const rate = rates.find(r => r.date.getTime() <= dTime); // Find first rate older or equal
    if (rate) return rate.value;

    // If date is OLDER than all history (e.g. 2010), take oldest
    if (rates.length > 0 && dTime < rates[rates.length - 1].date.getTime()) return rates[rates.length - 1].value;

    // If date is NEWER than latest (should be covered by first check, but if array empty?)
    if (rates.length > 0) return rates[0].value;

    return 1200;
};

async function main() {
    console.log("Fetching Data...");

    // Fetch Rates
    rates = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });
    console.log(`Loaded ${rates.length} rates. Latest: ${rates[0]?.value}`);

    // Fetch DNC3D
    const investments = await prisma.investment.findMany({
        where: { ticker: { contains: 'DNC3D' } },
        include: { transactions: true, cashflows: true }
    });

    if (investments.length === 0) {
        console.log("No DNC3D investment found.");
        return;
    }

    const inv = investments[0]; // Take first found
    console.log(`\nProcessing ${inv.ticker} (User: ${inv.userId})...`);
    console.log(`Transactions: ${inv.transactions.length}`);
    console.log(`Cashflows (DB): ${inv.cashflows.length}`);

    // 1. Prepare Cashflows for TIR
    // Transactions (Outflows)
    const txFlows = inv.transactions.map((tx: any) => {
        let amount = Math.abs(tx.totalAmount);
        let original = amount;
        let rateUsed = 1;

        if (tx.currency === 'ARS') {
            const rate = getExchangeRate(tx.date);
            rateUsed = rate;
            if (rate && rate > 0) amount = amount / rate;
        }

        console.log(`TX: ${tx.date.toISOString().split('T')[0]} | ${tx.currency} ${original} -> USD ${amount.toFixed(2)} (Rate: ${rateUsed})`);

        return {
            amount: -amount, // Negative for buying (Outflow)
            date: tx.date
        };
    });

    // Cashflows (Inflows)
    const inflows = inv.cashflows
        .filter((cf: any) => cf.status === 'PROJECTED')
        .map((cf: any) => ({
            amount: cf.amount,
            date: cf.date
        }));

    console.log(`Inflows: ${inflows.length}`);
    inflows.forEach((inf: any) => console.log(`CF: ${inf.date.toISOString().split('T')[0]} | USD ${inf.amount}`));

    const allFlows = [...txFlows, ...inflows];

    // Sort Flows
    allFlows.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    const amounts = allFlows.map((f: any) => f.amount);
    const dates = allFlows.map((f: any) => f.date);

    console.log(`\nCalculating XIRR with ${allFlows.length} items...`);
    try {
        const result = calculateXIRR(amounts, dates);
        if (result === null) {
            console.log("XIRR Result: NULL (Could not converge or invalid data)");
            // Log raw flows for verification
            console.log(allFlows.map(f => `${f.date.toISOString().split('T')[0]}: ${f.amount}`).join('\n'));
        } else {
            console.log(`XIRR Result: ${(result * 100).toFixed(2)}%`);
        }
    } catch (e) {
        console.error("XIRR Failed:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
