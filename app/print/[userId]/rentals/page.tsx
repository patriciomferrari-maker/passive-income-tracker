import { prisma } from '@/lib/prisma';
import { RentalsDashboardView } from '@/components/rentals/RentalsDashboardView';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: {
        userId: string;
    };
    searchParams: {
        secret?: string;
    };
}

export default async function RentalsPrintPage({ params, searchParams }: PageProps) {
    // 1. Security Check
    if (searchParams.secret !== process.env.CRON_SECRET) {
        return notFound();
    }

    const { userId } = params;
    const now = new Date();

    // 2. Fetch Data (Logic adapted from /api/rentals/dashboard)
    const allContracts = await prisma.contract.findMany({
        where: {
            property: { userId }
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

    const lastCashflowWithInflation = await prisma.rentalCashflow.findFirst({
        where: { inflationAccum: { not: null } },
        orderBy: { date: 'desc' }
    });

    let cutoffDate = new Date();
    if (lastCashflowWithInflation) {
        const lastDate = new Date(lastCashflowWithInflation.date);
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

        const filteredCashflows = cashflows.filter(cf => cf.date <= cutoffDate);

        const chartData = filteredCashflows.map(cf => ({
            date: cf.date.toISOString(),
            monthLabel: new Date(cf.date).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
            amountUSD: cf.amountUSD || 0,
            amountARS: cf.amountARS || 0,
            inflationAccum: (cf.inflationAccum || 0) * 100,
            devaluationAccum: (cf.devaluationAccum || 0) * 100
        }));

        return {
            contractId: contract.id,
            propertyName: contract.property.name,
            tenantName: contract.tenantName,
            currency: contract.currency,
            initialRent: contract.initialRent,
            startDate: contract.startDate.toISOString(),
            durationMonths: contract.durationMonths,
            adjustmentType: contract.adjustmentType,
            adjustmentFrequency: contract.adjustmentFrequency,
            chartData
        };
    }));

    // 3. Render View
    return (
        <div className="p-8 bg-slate-950 min-h-screen text-slate-100 print:bg-white print:text-black">
            <style>{`
                @page {
                    size: A4 landscape;
                    margin: 10mm;
                }
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            `}</style>

            <div className="mb-8 print:mb-4 border-b border-slate-800 print:border-slate-300 pb-4">
                <h1 className="text-2xl font-bold text-white print:text-slate-900">Reporte de Alquileres</h1>
                <p className="text-slate-400 print:text-slate-600">
                    {now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                </p>
            </div>

            <RentalsDashboardView data={dashboardData} />
        </div>
    );
}
