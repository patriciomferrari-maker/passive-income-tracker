import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const userId = await getUserId();
        const now = new Date();

        const allContracts = await prisma.contract.findMany({
            where: {
                property: { userId, isConsolidated: true } // Filter strictly by user's properties AND consolidated status
            },
            include: {
                property: true
            }
        });

        const activeContracts = allContracts.filter(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            return start <= now && end >= now;
        });

        // Use the last cashflow with valid Inflation data as the cutoff.
        const lastCashflowWithInflation = await prisma.rentalCashflow.findFirst({
            where: { inflationAccum: { not: null } },
            orderBy: { date: 'desc' }
        });

        let cutoffDate = new Date();
        if (lastCashflowWithInflation) {
            const lastDate = new Date(lastCashflowWithInflation.date);
            // End of that month
            cutoffDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
        }

        const dashboardData = await Promise.all(activeContracts.map(async (contract) => {
            const cashflows = await prisma.rentalCashflow.findMany({
                where: {
                    contractId: contract.id
                },
                orderBy: {
                    date: 'asc'
                }
            });

            // Filter cashflows to only show data up to the last known IPC date
            // This prevents plotting future projected months where Inf/Dev data is missing/flat
            const filteredCashflows = cashflows.filter(cf => cf.date <= cutoffDate);

            const chartData = filteredCashflows.map(cf => ({
                date: cf.date.toISOString(),
                monthLabel: new Date(cf.date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
                amountUSD: cf.amountUSD || 0,
                amountARS: cf.amountARS || 0, // Needed for Total Income calculation if we want ARS too
                inflationAccum: (cf.inflationAccum || 0) * 100,
                devaluationAccum: (cf.devaluationAccum || 0) * 100
            }));

            return {
                contractId: contract.id,
                propertyName: contract.property.name,
                tenantName: contract.tenantName,
                currency: contract.currency,
                initialRent: contract.initialRent,
                startDate: contract.startDate,
                durationMonths: contract.durationMonths,
                adjustmentType: contract.adjustmentType,
                adjustmentFrequency: contract.adjustmentFrequency,
                chartData
            };
        }));

        return NextResponse.json(dashboardData);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);

        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
