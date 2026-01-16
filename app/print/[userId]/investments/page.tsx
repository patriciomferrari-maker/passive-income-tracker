
import { prisma } from '@/lib/prisma';
import InvestmentsDashboardPrint from './InvestmentsDashboardPrint';
import { addMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string; market?: 'ARG' | 'USA' }>;
}

async function getDashboardData(userId: string, market: 'ARG' | 'USA') {
    const investments = await prisma.investment.findMany({
        where: {
            userId,
            market
        },
        include: {
            transactions: true,
            cashflows: {
                where: {
                    date: { gte: new Date() },
                    status: 'PROJECTED'
                },
                orderBy: { date: 'asc' }
            }
        }
    });

    // 0. Fetch Exchange Rates (History for TIR) & Asset Prices
    const allRates = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });
    const latestExchangeRate = allRates[0]?.value || 1160;

    const getExchangeRate = (date: Date): number => {
        // Find closest rate <= date
        // Since list is descending, we look for first rate where r.date <= date
        // Wait, array is Descending (Newest first).
        // e.g. [2024-01-20, 2024-01-19...]
        // If we want rate for 2024-01-15, we iterate until we find <= 2024-01-15?
        // Actually, if we want historical rate, we should find one CLOSE to that date.
        // Array.find returns the first element matching.
        // If we sort DESC, finding (r.date <= date) gives the newest rate that is OLDER/EQUAL to date. 
        // Example: Date=2024-01-15. Rates= [20, 19, 16, 14]. Find(<=15) -> 14. Correct? 
        // Yes, this finds the most recent rate as of that date.
        const rate = allRates.find(r => r.date <= date);
        if (rate) return rate.value;
        if (allRates.length > 0) return allRates[allRates.length - 1].value; // Oldest fallback
        return 1200;
    };

    // Fetch Latest Asset Prices
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


    // Helper to safely convert Prisma Decimals/Strings to Number
    const toNumber = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
        if (typeof val === 'string') return parseFloat(val) || 0;
        if (typeof val === 'object') {
            if ('toNumber' in val && typeof val.toNumber === 'function') return val.toNumber();
            if ('toString' in val && typeof val.toString === 'function') return parseFloat(val.toString()) || 0;
        }
        return 0;
    };

    // 1. Calculate Valuation & Allocation & TIR Data Construction
    let totalValueUSD = 0;
    const allocationMap = new Map<string, number>();

    // TIR Data Arrays
    const tirAmounts: number[] = [];
    const tirDates: Date[] = [];

    const activeInvestments = investments.map(inv => {
        // -- 1. Valuation Logic --
        let quantity = 0;

        // Process Transactions for both Quantity and TIR
        inv.transactions.forEach(t => {
            const qty = toNumber(t.quantity);
            const totalAmountIdx = toNumber(t.totalAmount); // Negative for BUY usually

            if (t.type === 'BUY') {
                quantity += qty;

                // For TIR: Add Outflow (Negative)
                // Normalize to USD using Historical Rate
                let amountUSD = -Math.abs(totalAmountIdx);
                if (t.currency === 'ARS') {
                    const rate = getExchangeRate(t.date);
                    amountUSD = amountUSD / rate;
                }
                tirAmounts.push(amountUSD);
                tirDates.push(t.date);

            } else if (t.type === 'SELL') {
                quantity -= qty;
                // For TIR: Add Inflow (Positive) - Not fully handled in dashboard logic shown, 
                // but usually SELL is a positive cashflow.
                // Dashboard logic: "Add all BUY transactions as negative... Add ALL cashflows". 
                // Does it handle SELLs? `positions` logic handles P&L. 
                // XIRR usually relies on Cashflows (Coupons + Amort + Final Sale).
                // If we include SELL transaction as a cashflow, it should be positive.
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

        // Smart Price Logic for Valuation
        let rawPrice = priceMap[inv.id] !== undefined ? priceMap[inv.id] : toNumber(inv.lastPrice);

        // 2. Normalize "Per 100" convention (Common for ONs)
        if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && rawPrice > 2.0) {
            // Heuristic: If it's huge, it's likely per 100.
            // But wait, if it's 108.3 (USD per 100), /100 = 1.083. Correct.
            // If it's 160,000 (ARS per 100), /100 = 1600. Correct.
            // If it's 1.05 (USD unit), rawPrice > 2.0 is False. stays 1.05. Correct.
            rawPrice = rawPrice / 100;
        }

        let priceUSD = rawPrice;

        // 3. Detect Currency & Convert to USD
        // CRITICAL FIX: Ignore inv.currency for the decision to convert.
        // Data sources often mix USD and ARS prices for the same ticker.
        // Heuristic: If price is > 50, it is definitely ARS (Exchange rate ~1100).
        // ONs trade ~1.00 USD. CEDEARs ~5-20 USD. 
        // Anything above 50 is likely ARS.
        if (priceUSD > 50.0) {
            priceUSD = priceUSD / latestExchangeRate;
        }

        const value = quantity * priceUSD;

        if (value > 0) {
            totalValueUSD += value;
            const type = inv.type || 'OTRO';
            allocationMap.set(type, (allocationMap.get(type) || 0) + value);
        }

        // -- 2. Cashflows for TIR & Arrays --
        const cleanTransactions = inv.transactions.map(t => ({
            ...t,
            amount: toNumber(t.amount),
            price: toNumber(t.price),
            totalAmount: toNumber(t.totalAmount),
            date: t.date.toISOString(),
            createdAt: undefined,
            updatedAt: undefined
        }));

        const cleanCashflows = inv.cashflows.map(c => {
            // For TIR: Add Cashflow
            let amount = toNumber(c.amount);
            const cfDate = c.date;
            const cfCurrency = c.currency || inv.currency;

            // Conversion Logic for TIR
            if (cfCurrency === 'ARS') {
                // Past vs Future Rate
                const rate = cfDate <= new Date() ? getExchangeRate(cfDate) : latestExchangeRate;
                if (rate > 0) amount = amount / rate;
            }

            tirAmounts.push(amount);
            tirDates.push(cfDate);

            return {
                ...c,
                amount: toNumber(c.amount),
                date: c.date
            };
        });

        return {
            ...inv,
            quantity,
            currentPrice: priceUSD,
            maturityDate: inv.maturityDate ? inv.maturityDate.toISOString() : null,
            emissionDate: inv.emissionDate ? inv.emissionDate.toISOString() : null,
            lastPriceDate: inv.lastPriceDate ? inv.lastPriceDate.toISOString() : null,
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
            transactions: cleanTransactions,
            cashflows: cleanCashflows
        };
    }).filter(i => i.quantity > 0 || i.type === 'ON');

    // Add current portfolio value as a final cashflow for XIRR calculation
    if (totalValueUSD > 0) {
        tirAmounts.push(totalValueUSD);
        tirDates.push(new Date());
    }

    const allocation = Array.from(allocationMap.entries()).map(([name, value]) => ({
        name: name || 'Desconocido',
        value: Number.isFinite(value) ? value : 0,
        fill: '#cccccc'
    })).sort((a, b) => b.value - a.value);

    // 2. Projected Income & XIRR Calculation
    const { calculateXIRR } = await import('@/lib/financial');
    const calculatedTIR = calculateXIRR(tirAmounts, tirDates);
    const yieldAPY = calculatedTIR ? calculatedTIR * 100 : 0;

    // Projected Income (Next 12 Months) - kept for chart
    const now = new Date();
    const nextYear = addMonths(now, 12);
    let totalIncomeUSD = 0;
    const monthlyFlowsMap = new Map<string, number>();

    // Initial 12 months buckets
    for (let i = 0; i < 12; i++) {
        const d = addMonths(now, i);
        const label = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
        monthlyFlowsMap.set(label, 0);
    }

    activeInvestments.forEach(inv => { // Using processed list
        // Note: inv.cashflows here have Date objects from above map.
        inv.cashflows.forEach(cf => {
            // @ts-ignore - we know it's a date object before stringify step below
            const dateObj = cf.date;

            if (dateObj <= nextYear && dateObj >= now) {
                let amountUSD = Number(cf.amount);
                if (cf.currency === 'ARS') amountUSD = amountUSD / latestExchangeRate;

                if (Number.isFinite(amountUSD)) {
                    totalIncomeUSD += amountUSD;
                    const label = dateObj.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                    if (monthlyFlowsMap.has(label)) {
                        monthlyFlowsMap.set(label, (monthlyFlowsMap.get(label) || 0) + amountUSD);
                    } else {
                        monthlyFlowsMap.set(label, (monthlyFlowsMap.get(label) || 0) + amountUSD);
                    }
                }
            }
        });
    });

    const monthlyFlows = Array.from(monthlyFlowsMap.entries()).map(([monthLabel, amountUSD]) => ({
        monthLabel,
        amountUSD: Number.isFinite(amountUSD) ? Math.round(amountUSD) : 0
    }));

    // 3. Stringify Dates for Transport
    const safeInvestments = activeInvestments.map(inv => ({
        ...inv,
        cashflows: inv.cashflows.map(cf => ({
            ...cf,
            date: (cf.date as unknown as Date).toISOString()
        }))
    }));

    const reportDate = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    return {
        investments: safeInvestments as any,
        globalData: {
            totalValueUSD: Number.isFinite(totalValueUSD) ? totalValueUSD : 0,
            totalIncomeUSD: Number.isFinite(totalIncomeUSD) ? totalIncomeUSD : 0,
            yieldAPY, // Now represents Consolidated TIR
            allocation,
            monthlyFlows
        },
        reportDate
    };
}

export default async function PrintInvestmentsPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret, market } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500 p-8">Unauthorized</div>;
    }

    const selectedMarket = market || 'ARG';
    const rawData = await getDashboardData(userId, selectedMarket);

    // NUCLEAR FIX: Verify strict serialization by parsing/stringifying
    const data = JSON.parse(JSON.stringify(rawData));

    return (
        <InvestmentsDashboardPrint
            investments={data.investments}
            globalData={data.globalData}
            market={selectedMarket}
            reportDate={data.reportDate}
        />
    );
}
