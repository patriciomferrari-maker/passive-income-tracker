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
                property: { userId } // Filter strictly by user's properties
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

            // NEW RULE: Nominal Charts (Income/Expense) go up to TODAY.
            // Charts with Inflation/Devaluation stop at last IPC.
            // We pass ALL data, and let the frontend decide (or valid nulls).
            // Actually, we can just return all cashflows up to today for general charts.
            const todayEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            // Filter cashflows up to current month (regardless of IPC)
            const filteredCashflows = cashflows.filter(cf => cf.date <= todayEnd);

            const chartData = filteredCashflows.map(cf => ({
                date: cf.date.toISOString(),
                monthLabel: new Date(cf.date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
                amountUSD: cf.amountUSD || 0,
                amountARS: cf.amountARS || 0,
                // Pass null if data is missing, so Recharts breaks the line instead of plotting 0
                inflationAccum: cf.inflationAccum !== null ? (cf.inflationAccum * 100) : null,
                devaluationAccum: cf.devaluationAccum !== null ? (cf.devaluationAccum * 100) : null
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
                chartData,
                chartData,
                isConsolidated: contract.property.isConsolidated,
                propertyRole: (contract.property as any).role || 'OWNER' // Cast as any if TS complains about missing role in type
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
