
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
            currentPrice: price,
            transactions: inv.transactions, // Type casting needed? 
            cashflows: inv.cashflows
        };
    }).filter(i => i.quantity > 0 || i.type === 'ON'); // Keep ONs even if quantity is 0? No, usually quantity > 0.
    // Actually, for ONs, quantity is face value, so it should be > 0.

    const allocation = Array.from(allocationMap.entries()).map(([name, value]) => ({
        name,
        value,
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

                totalIncomeUSD += amountUSD;

                const label = cf.date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                // We might need strict Key matching (Month/Year indices) to avoid locale issues
                // But map.has(label) works if generated same way.
                // Let's use a simpler approach key: "YYYY-MM"
                if (monthlyFlowsMap.has(label)) {
                    monthlyFlowsMap.set(label, (monthlyFlowsMap.get(label) || 0) + amountUSD);
                } else {
                    // Try to match created keys (sometimes date differs slightly)
                    // For simplicity, just add if it matches the bucket roughly?
                    // Let's stick to strict map for "dashboard-y" feel
                    monthlyFlowsMap.set(label, (monthlyFlowsMap.get(label) || 0) + amountUSD);
                }
            }
        });
    });

    const monthlyFlows = Array.from(monthlyFlowsMap.entries()).map(([monthLabel, amountUSD]) => ({
        monthLabel,
        amountUSD: Math.round(amountUSD)
    }));
    // Note: The map iteration order is insertion order, so it stays sorted by date.

    // 3. Yield Estimate (Simple: Annualized Income / Total Value)
    const yieldAPY = totalValueUSD > 0 ? (totalIncomeUSD / totalValueUSD) * 100 : 0;

    return {
        investments: activeInvestments as any,
        globalData: {
            totalValueUSD,
            totalIncomeUSD,
            yieldAPY,
            allocation,
            monthlyFlows
        }
    };
}

export default async function PrintInvestmentsPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret, market } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500 p-8">Unauthorized</div>;
    }

    const selectedMarket = market || 'ARG';
    const data = await getDashboardData(userId, selectedMarket);

    return (
        <InvestmentsDashboardPrint
            investments={data.investments}
            globalData={data.globalData}
            market={selectedMarket}
        />
    );
}
