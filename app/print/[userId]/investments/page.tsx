
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { differenceInMonths, addMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string; market?: 'ARG' | 'USA' }>;
}

async function getInvestmentData(userId: string, market?: 'ARG' | 'USA') {
    const investments = await prisma.investment.findMany({
        where: {
            userId,
            ...(market ? { market } : {})
        },
        include: {
            transactions: true,
            cashflows: {
                where: {
                    date: { gte: new Date() },
                    status: 'PROJECTED'
                },
                orderBy: { date: 'asc' },
                take: 20
            }
        }
    });

    // Simple valuation logic (Market Value)
    // ...
    // Future Flows (Next 3 Months)
    const now = new Date();
    const threeMonths = addMonths(now, 3);
    const flows: any[] = [];

    for (const inv of investments) {
        // ... (existing logic)
        const relevantFlows = inv.cashflows.filter(cf => cf.date <= threeMonths);
        flows.push(...relevantFlows.map(cf => ({
            date: cf.date,
            ticker: inv.ticker || inv.name,
            type: cf.type,
            amount: cf.amount,
            currency: cf.currency
        })));
    }

    return {
        investments,
        futureFlows: flows.sort((a, b) => a.date.getTime() - b.date.getTime())
    };
}

export default async function PrintInvestmentsPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret, market } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500">Unauthorized</div>;
    }

    const data = await getInvestmentData(userId, market);
    const title = market === 'ARG' ? 'Inversiones Argentina' : (market === 'USA' ? 'Inversiones USA' : 'Reporte de Inversiones');

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold border-b pb-4">{title}</h1>

            {/* 1. Valuation Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="print-card border p-4 rounded bg-slate-50">
                    <h3 className="font-bold text-slate-500 text-sm uppercase">Flujos Proyectados (3 Meses)</h3>
                    <p className="text-2xl font-bold">{data.futureFlows.length} Eventos</p>
                </div>
            </div>

            {/* 2. Future Flows Table */}
            <div className="print-card border rounded overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b">
                        <tr>
                            <th className="p-2 text-left">Fecha</th>
                            <th className="p-2 text-left">Activo</th>
                            <th className="p-2 text-left">Evento</th>
                            <th className="p-2 text-right">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.futureFlows.map((flow, idx) => (
                            <tr key={idx} className="border-b last:border-0">
                                <td className="p-2">{flow.date.toLocaleDateString()}</td>
                                <td className="p-2 font-semibold">{flow.ticker}</td>
                                <td className="p-2 capitalize">{flow.type.toLowerCase()}</td>
                                <td className="p-2 text-right font-mono">
                                    {flow.currency} {flow.amount.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {data.futureFlows.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin cobros próximos</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="text-center text-xs text-slate-400 mt-8">
                Generado para uso interno
            </div>
        </div>
    );
}
