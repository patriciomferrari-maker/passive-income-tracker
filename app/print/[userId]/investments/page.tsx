
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

    // 0. Fetch Exchange Rate (Blue Dollar)
    const latestExchangeRate = await prisma.economicIndicator.findFirst({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });
    const exchangeRate = latestExchangeRate?.value || 1160;

    // 0b. Fetch Latest Asset Prices (Mirroring Dashboard Logic)
    // The Dashboard doesn't trust inv.lastPrice alone; it checks AssetPrice table.
    const invIds = investments.map(i => i.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentPrices = await prisma.assetPrice.findMany({
        where: { investmentId: { in: invIds }, date: { gte: weekAgo } },
        orderBy: { date: 'desc' }
    });

    const priceMap: Record<string, number> = {};
    recentPrices.forEach(p => {
        // We want the LATEST price for each investment
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

    // 1. Calculate Valuation & Allocation
    let totalValueUSD = 0;
    const allocationMap = new Map<string, number>();

    const activeInvestments = investments.map(inv => {
        // Calculate Quantity from Transactions
        let quantity = 0;
        inv.transactions.forEach(t => {
            const qty = toNumber(t.quantity);
            if (t.type === 'BUY') quantity += qty;
            else if (t.type === 'SELL') quantity -= qty;
            else quantity += qty;
        });

        // Smart Price Logic
        // 1. Get raw price (Try priceMap first, then fallback to lastPrice)
        let rawPrice = priceMap[inv.id] !== undefined ? priceMap[inv.id] : toNumber(inv.lastPrice);

        // 2. Normalize "Per 100" convention (Common for ONs)
        // If price is massive (e.g. 160,000), it's likely ARS per 100.
        // If price is 100-200, it's likely USD per 100 (resulting in 1-2).
        if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && rawPrice > 2.0) {
            rawPrice = rawPrice / 100;
        }

        // 3. Detect Currency & Convert to USD
        // If price is still > 10 (e.g. 1300 ARS normalized from 130,000), it's definitely ARS.
        // ONs usually trade between 0.50 and 1.50 USD.
        let priceUSD = rawPrice;

        // Explicit ARS check or Heuristic check (Price > 5 USD is rare for ON unit price)
        if (inv.currency === 'ARS' || priceUSD > 5.0) {
            priceUSD = priceUSD / exchangeRate;
        }

        const value = quantity * priceUSD;

        if (value > 0) {
            totalValueUSD += value;
            const type = inv.type || 'OTRO';
            allocationMap.set(type, (allocationMap.get(type) || 0) + value);
        }

        const cleanTransactions = inv.transactions.map(t => ({
            ...t,
            amount: toNumber(t.amount),
            price: toNumber(t.price),
            totalAmount: toNumber(t.totalAmount),
            date: t.date.toISOString(),
            createdAt: undefined,
            updatedAt: undefined
        }));

        const cleanCashflows = inv.cashflows.map(c => ({
            ...c,
            amount: toNumber(c.amount),
            date: c.date // Date object is kept for logic below
        }));

        return {
            ...inv,
            quantity,
            currentPrice: priceUSD, // We pass the CLEAN USD price to the client
            maturityDate: inv.maturityDate ? inv.maturityDate.toISOString() : null,
            emissionDate: inv.emissionDate ? inv.emissionDate.toISOString() : null,
            lastPriceDate: inv.lastPriceDate ? inv.lastPriceDate.toISOString() : null,
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
            transactions: cleanTransactions,
            cashflows: cleanCashflows
        };
    }).filter(i => i.quantity > 0 || i.type === 'ON');

    const allocation = Array.from(allocationMap.entries()).map(([name, value]) => ({
        name: name || 'Desconocido',
        value: Number.isFinite(value) ? value : 0,
        fill: '#cccccc' // Will be overridden by component
    })).sort((a, b) => b.value - a.value);

    // 2. Projected Income (Next 12 Months)
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

    activeInvestments.forEach(inv => {
        inv.cashflows.forEach(cf => {
            // cf.date is still a Date object here because we didn't stringify it in the first map (left it for logic)
            if (cf.date <= nextYear && cf.date >= now) {
                let amountUSD = cf.amount; // Already a number
                if (cf.currency === 'ARS') amountUSD = cf.amount / exchangeRate;

                if (Number.isFinite(amountUSD)) {
                    totalIncomeUSD += amountUSD;
                    const label = cf.date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                    if (monthlyFlowsMap.has(label)) {
                        monthlyFlowsMap.set(label, (monthlyFlowsMap.get(label) || 0) + amountUSD);
                    } else {
                        monthlyFlowsMap.set(label, (monthlyFlowsMap.get(label) || 0) + amountUSD);
                    }
                }
            }
        });
    });

    // NOW stringify cashflow dates for the client
    const safeInvestments = activeInvestments.map(inv => ({
        ...inv,
        cashflows: inv.cashflows.map(cf => ({
            ...cf,
            date: typeof cf.date === 'object' ? (cf.date as Date).toISOString() : cf.date
        }))
    }));

    const monthlyFlows = Array.from(monthlyFlowsMap.entries()).map(([monthLabel, amountUSD]) => ({
        monthLabel,
        amountUSD: Number.isFinite(amountUSD) ? Math.round(amountUSD) : 0
    }));

    // 3. Yield Estimate
    let yieldAPY = 0;
    if (totalValueUSD > 0 && Number.isFinite(totalIncomeUSD) && Number.isFinite(totalValueUSD)) {
        yieldAPY = (totalIncomeUSD / totalValueUSD) * 100;
    }
    yieldAPY = Number.isFinite(yieldAPY) ? yieldAPY : 0;

    const reportDate = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    return {
        investments: safeInvestments as any,
        globalData: {
            totalValueUSD: Number.isFinite(totalValueUSD) ? totalValueUSD : 0,
            totalIncomeUSD: Number.isFinite(totalIncomeUSD) ? totalIncomeUSD : 0,
            yieldAPY,
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
