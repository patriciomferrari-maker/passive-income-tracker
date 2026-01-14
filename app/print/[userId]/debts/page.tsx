
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

async function getDebtData(userId: string) {
    // 1. Debts (Pasivos) - Money I owe
    const debts = await prisma.debt.findMany({
        where: { userId, type: 'OWED_BY_ME' },
        include: { payments: true }
    });

    // 2. Receivables (A Cobrar) - Money owed to me
    const receivables = await prisma.debt.findMany({
        where: { userId, type: 'OWED_TO_ME' },
        include: { payments: true }
    });

    // Calculate pending amounts
    const process = (items: any[]) => items
        .map(d => {
            const paid = d.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
            const pending = d.amount - paid;
            return { ...d, paid, pending };
        })
        .filter(d => d.pending > 1); // Only showing active ones

    return {
        debts: process(debts),
        receivables: process(receivables)
    };
}

export default async function PrintDebtsPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500">Unauthorized</div>;
    }

    const data = await getDebtData(userId);

    const formatCurrency = (val: number, cur: string) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur }).format(val);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold border-b pb-4">Reporte de Deudas</h1>

            {/* Debts Table */}
            <div className="print-card border rounded overflow-hidden">
                <div className="bg-red-50 border-b p-3 font-bold text-sm uppercase text-red-700">
                    Pasivos (Deudas a Pagar)
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-red-50/50">
                            <th className="p-2 text-left">Acreedor</th>
                            <th className="p-2 text-left">Concepto</th>
                            <th className="p-2 text-right">Monto Original</th>
                            <th className="p-2 text-right">Pagado</th>
                            <th className="p-2 text-right">Pendiente</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.debts.map((d) => (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                                <td className="p-2 font-semibold">{d.creditor}</td>
                                <td className="p-2 text-slate-600">{d.description}</td>
                                <td className="p-2 text-right text-slate-400">{formatCurrency(d.amount, 'USD')}</td>
                                <td className="p-2 text-right text-green-600">{formatCurrency(d.paid, 'USD')}</td>
                                <td className="p-2 text-right font-bold text-red-600">{formatCurrency(d.pending, 'USD')}</td>
                            </tr>
                        ))}
                        {data.debts.length === 0 && (
                            <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin deudas pendientes</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Receivables Table */}
            <div className="print-card border rounded overflow-hidden">
                <div className="bg-emerald-50 border-b p-3 font-bold text-sm uppercase text-emerald-700">
                    Activos (Cuentas a Cobrar)
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-emerald-50/50">
                            <th className="p-2 text-left">Deudor</th>
                            <th className="p-2 text-left">Concepto</th>
                            <th className="p-2 text-right">Monto Original</th>
                            <th className="p-2 text-right">Cobrado</th>
                            <th className="p-2 text-right">Pendiente</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.receivables.map((d) => (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50">
                                <td className="p-2 font-semibold">{d.debtor || d.creditor}</td>
                                <td className="p-2 text-slate-600">{d.description}</td>
                                <td className="p-2 text-right text-slate-400">{formatCurrency(d.amount, 'USD')}</td>
                                <td className="p-2 text-right text-green-600">{formatCurrency(d.paid, 'USD')}</td>
                                <td className="p-2 text-right font-bold text-emerald-600">{formatCurrency(d.pending, 'USD')}</td>
                            </tr>
                        ))}
                        {data.receivables.length === 0 && (
                            <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin cuentas a cobrar</td></tr>
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
