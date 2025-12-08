
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
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

        // Fetch last IPC for date cutoff (consistency with other charts)
        const lastIPC = await prisma.economicIndicator.findFirst({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' }
        });
        const cutoffDate = lastIPC ? lastIPC.date : new Date();

        // --- KPIs ---
        const activeCount = activeContracts.length;
        const occupancyRate = totalPropertiesCount > 0 ? (activeCount / totalPropertiesCount) * 100 : 0;

        // Fetch ALL cashflows for aggregation
        // We must filter by contracts that belong to the user
        const allCashflows = await prisma.rentalCashflow.findMany({
            where: {
                contract: { property: { userId } }
            },
            orderBy: { date: 'asc' }
        });

        // Filter by cutoff date
        const validCashflows = allCashflows.filter(cf => cf.date <= cutoffDate);

        // --- Aggregation Logic ---
        // Group by Month (YYYY-MM)
        const monthlyData = new Map<string, {
            date: Date,
            totalUSD: number,
            totalARS: number,
            count: number
        }>();

        validCashflows.forEach(cf => {
            const dateKey = cf.date.toISOString().slice(0, 7); // YYYY-MM

            if (!monthlyData.has(dateKey)) {
                monthlyData.set(dateKey, {
                    date: cf.date,
                    totalUSD: 0,
                    totalARS: 0,
                    count: 0
                });
            }
            const entry = monthlyData.get(dateKey)!;
            entry.totalUSD += cf.amountUSD || 0;
            entry.totalARS += cf.amountARS || 0;
            entry.count += 1;
        });

        const historyChartData = Array.from(monthlyData.values())
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(d => ({
                date: d.date.toISOString(),
                monthLabel: new Date(d.date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
                totalUSD: d.totalUSD,
                contractCount: d.count
            }));

        let currentMonthlyRevenueUSD = 0;

        for (const contract of activeContracts) {
            const latestCf = await prisma.rentalCashflow.findFirst({
                where: {
                    contractId: contract.id,
                    date: { lte: now }
                },
                orderBy: { date: 'desc' }
            });

            if (latestCf) {
                currentMonthlyRevenueUSD += latestCf.amountUSD || 0;
            } else {
                if (contract.currency === 'USD') {
                    currentMonthlyRevenueUSD += contract.initialRent;
                }
            }
        }

        // --- Currency Distribution ---
        const currencyDist = {
            USD: activeContracts.filter(c => c.currency === 'USD').length,
            ARS: activeContracts.filter(c => c.currency === 'ARS').length
        };

        return NextResponse.json({
            kpis: {
                totalProperties: totalPropertiesCount,
                activeContracts: activeCount,
                occupancyRate,
                currentMonthlyRevenueUSD
            },
            history: historyChartData,
            currencyDistribution: currencyDist
        });

    } catch (error) {
        console.error('Error fetching global dashboard data:', error);
        return unauthorized();
    }
}
