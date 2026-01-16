
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

    // 1. Calculate Valuation & Allocation
    let totalValueUSD = 0;
    const allocationMap = new Map<string, number>();

    const activeInvestments = investments.map(inv => {
        // Simple valuation: quantity * currentPrice (if set manually) or logic
        // For now relying on `currentPrice` being populated by trackers
        const price = inv.currentPrice || 0;
        const value = inv.quantity * price;

        if (value > 0) {
            totalValueUSD += value;
            const type = inv.type || 'OTRO';
            allocationMap.set(type, (allocationMap.get(type) || 0) + value);
        }

        return {
            ...inv,
            maturityDate: inv.maturityDate ? inv.maturityDate.toISOString() : null,
            emissionDate: inv.emissionDate ? inv.emissionDate.toISOString() : null,
            lastPriceDate: inv.lastPriceDate ? inv.lastPriceDate.toISOString() : null,
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
            currentPrice: price,
            transactions: inv.transactions.map(t => ({ ...t, date: t.date.toISOString(), createdAt: undefined, updatedAt: undefined })),
            cashflows: inv.cashflows.map(c => ({ ...c, date: c.date.toISOString() }))
        };
    }).filter(i => i.quantity > 0 || i.type === 'ON'); // Keep ONs even if quantity is 0? No, usually quantity > 0.
    // Actually, for ONs, quantity is face value, so it should be > 0.

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
            if (cf.date <= nextYear && cf.date >= now) {
                // Determine USD Amount (approx for ARS)
                let amountUSD = cf.amount;
                if (cf.currency === 'ARS') amountUSD = cf.amount / 1100; // Hardcoded exchange rate fallback or 0
                else amountUSD = cf.amount;

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

    const monthlyFlows = Array.from(monthlyFlowsMap.entries()).map(([monthLabel, amountUSD]) => ({
        monthLabel,
        amountUSD: Number.isFinite(amountUSD) ? Math.round(amountUSD) : 0
    }));
    // Note: The map iteration order is insertion order, so it stays sorted by date.

    // 3. Yield Estimate (Simple: Annualized Income / Total Value)
    let yieldAPY = 0;
    if (totalValueUSD > 0 && Number.isFinite(totalIncomeUSD) && Number.isFinite(totalValueUSD)) {
        yieldAPY = (totalIncomeUSD / totalValueUSD) * 100;
    }
    yieldAPY = Number.isFinite(yieldAPY) ? yieldAPY : 0;

    const reportDate = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    // Explicitly sanitize investments to primitive numbers
    const safeInvestments = activeInvestments.map(inv => ({
        ...inv,
        quantity: Number(inv.quantity) || 0,
        currentPrice: inv.currentPrice ? Number(inv.currentPrice) : 0,
        transactions: inv.transactions.map(t => ({
            ...t,
            amount: Number(t.amount),
            price: Number(t.price),
            totalAmount: Number(t.totalAmount)
        })),
        cashflows: inv.cashflows.map(cf => ({
            ...cf,
            amount: Number(cf.amount)
        }))
    }));

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
