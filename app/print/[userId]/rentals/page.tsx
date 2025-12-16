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

import { headers } from 'next/headers';

export default async function RentalsPrintPage({ params, searchParams }: PageProps) {
    const headerList = await headers();
    const secretHeader = headerList.get('X-Cron-Secret');
    const secret = secretHeader || searchParams.secret;

    // 1. Security Check
    if (secret !== process.env.CRON_SECRET) {
        return (
            <div className="p-10 text-red-600 bg-white">
                <h1 className="text-2xl font-bold mb-4">Access Denied (Debug Mode)</h1>
                <p><strong>Reason:</strong> Secret Mismatch</p>
                <div className="mt-4 p-4 bg-gray-100 rounded font-mono text-sm max-w-xl break-all">
                    <p>Received (Header): {secretHeader ? `"${secretHeader}"` : 'undefined'}</p>
                    <p>Received (URL): {searchParams.secret ? `"${searchParams.secret}"` : 'undefined'}</p>
                    <p>Expected (Env): {process.env.CRON_SECRET ? '"[HIDDEN/SET]"' : '"undefined (MISSING IN ENV)"'}</p>
                    <p>Expected Length: {process.env.CRON_SECRET?.length || 0}</p>
                    <p>Received Length: {secret?.length || 0}</p>
                </div>
                <p className="mt-4 text-sm text-gray-500">
                    If Expected is "undefined", you forgot to add CRON_SECRET to Vercel Environment Variables.
                </p>
            </div>
        );
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

            <RentalsDashboardView contractsData={dashboardData} globalData={null} showValues={true} />
        </div>
    );
}
