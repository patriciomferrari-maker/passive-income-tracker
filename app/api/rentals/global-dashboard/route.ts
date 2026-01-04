
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let session;
        try {
            const { auth } = await import('@/auth');
            session = await auth();
        } catch (e) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const userId = session.user.id;
        const now = new Date();

        // Fetch all properties to calculate occupancy (filtered by User)
        const totalPropertiesCount = await prisma.property.count({
            where: { userId }
        });

        // Fetch all contracts to calculate active status and historical aggregation (filtered by User's properties)
        const allContracts = await prisma.contract.findMany({
            where: { property: { userId } },
            include: {
                property: true
            }
        });

        // Filter active contracts
        const activeContracts = allContracts.filter(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            return start <= now && end >= now;
        });

        const cutoffDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month

        // --- KPIs ---
        const activeCount = activeContracts.length;
        const occupancyRate = totalPropertiesCount > 0 ? (activeCount / totalPropertiesCount) * 100 : 0;

        // Fetch ALL cashflows for aggregation
        // We must filter by contracts that belong to the user
        const allCashflows = await prisma.rentalCashflow.findMany({
            where: {
                contract: { property: { userId } }
            },
            include: {
                contract: {
                    include: {
                        property: true
                    }
                }
            },
            orderBy: { date: 'asc' }
        });

        // Filter by cutoff date
        const validCashflows = allCashflows.filter(cf => cf.date <= cutoffDate);

        // --- Aggregation Logic ---
        // Group by Month (YYYY-MM)
        // Group by Month (YYYY-MM)
        const monthlyData = new Map<string, {
            date: Date,
            incomeUSD: number,
            incomeARS: number,
            expenseUSD: number,
            expenseARS: number,
            count: number
        }>();

        validCashflows.forEach(cf => {
            const dateKey = cf.date.toISOString().slice(0, 7); // YYYY-MM

            if (!monthlyData.has(dateKey)) {
                monthlyData.set(dateKey, {
                    date: cf.date,
                    incomeUSD: 0,
                    incomeARS: 0,
                    expenseUSD: 0,
                    expenseARS: 0,
                    count: 0
                });
            }
            const entry = monthlyData.get(dateKey)!;

            // Check role (default to OWNER if missing)
            const role = (cf.contract.property as any).role || 'OWNER';

            if (role === 'TENANT') {
                entry.expenseUSD += cf.amountUSD || 0;
                entry.expenseARS += (cf as any).amountARS || 0; // Cast to any to bypass potential type issue if schema not regenerated
            } else {
                // OWNER
                entry.incomeUSD += cf.amountUSD || 0;
                entry.incomeARS += (cf as any).amountARS || 0;
            }

            entry.count += 1;
        });

        const historyChartData = Array.from(monthlyData.values())
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(d => ({
                date: d.date.toISOString(),
                monthLabel: new Date(d.date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
                totalUSD: d.incomeUSD, // Legacy support for existing charts expecting totalUSD
                incomeUSD: d.incomeUSD,
                expenseUSD: d.expenseUSD,
                contractCount: d.count
            }));

        let currentMonthlyRevenueUSD = 0;
        let currentMonthlyExpenseUSD = 0;

        for (const contract of activeContracts) {
            const role = (contract.property as any).role || 'OWNER';

            const latestCf = await prisma.rentalCashflow.findFirst({
                where: {
                    contractId: contract.id,
                    date: { lte: now }
                },
                orderBy: { date: 'desc' }
            });

            const amount = latestCf ? (latestCf.amountUSD || 0) : (contract.currency === 'USD' ? contract.initialRent : 0);

            if (role === 'TENANT') {
                currentMonthlyExpenseUSD += amount;
            } else {
                currentMonthlyRevenueUSD += amount;
            }
        }

        // --- Currency Distribution ---
        const currencyDist = {
            owner: {
                USD: activeContracts.filter(c => (c.property as any).role !== 'TENANT' && c.currency === 'USD').length,
                ARS: activeContracts.filter(c => (c.property as any).role !== 'TENANT' && c.currency === 'ARS').length
            },
            tenant: {
                USD: activeContracts.filter(c => (c.property as any).role === 'TENANT' && c.currency === 'USD').length,
                ARS: activeContracts.filter(c => (c.property as any).role === 'TENANT' && c.currency === 'ARS').length
            }
        };

        return NextResponse.json({
            kpis: {
                totalProperties: totalPropertiesCount,
                activeContracts: activeCount,
                occupancyRate,
                currentMonthlyRevenueUSD,
                currentMonthlyExpenseUSD
            },
            history: historyChartData,
            currencyDistribution: currencyDist
        });

    } catch (error) {
        console.error('Error fetching global dashboard data:', error);

        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
