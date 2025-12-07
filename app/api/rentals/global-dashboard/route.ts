
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const now = new Date();

        // Fetch all properties to calculate occupancy
        const totalPropertiesCount = await prisma.property.count();

        // Fetch all contracts to calculate active status and historical aggregation
        const allContracts = await prisma.contract.findMany({
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

        // Fetch ALL cashflows for aggregation (we want history of EVERYTHING, even closed contracts, if we want a true global history)
        // Or should we only show history of *currently active*? 
        // "Dashboard Consolidado" usually implies "My Portfolio History".
        // Let's fetch all cashflows for all contracts.
        const allCashflows = await prisma.rentalCashflow.findMany({
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

        // Current Monthly Revenue (Estimate based on latest month in history or active contracts?)
        // Better: Sum of the *latest* cashflow for each *active* contract.
        // Or simply the last point in the aggregated chart?
        // The last point in aggregated chart might be incomplete if we are mid-month.
        // Let's use the sum of "current rent" of active contracts.
        // We need the *latest* cashflow for each active contract to know its current rent.

        let currentMonthlyRevenueUSD = 0;

        for (const contract of activeContracts) {
            // Find the cashflow for the current month (or latest available)
            // Actually, we can just find the cashflow corresponding to "now" or the most recent one.
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
                // Fallback to initial rent? or 0.
                if (contract.currency === 'USD') {
                    currentMonthlyRevenueUSD += contract.initialRent;
                }
                // If ARS, difficult to guess without exchange rate. Ignore or use initial converted?
                // Let's stick to 0 to be safe/conservative.
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
        return NextResponse.json({ error: 'Failed to fetch global dashboard data' }, { status: 500 });
    }
}
