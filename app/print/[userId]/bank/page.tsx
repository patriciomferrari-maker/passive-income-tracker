
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

async function getBankData(userId: string) {
    // 1. Bank Operations (Plazo Fijo)
    const activePFs = await prisma.bankOperation.findMany({
        where: {
            userId,
            type: 'PLAZO_FIJO',
            startDate: { not: null }
        }
    });

    // 2. Liquidity (User Settings / Manual Input usually, but here we can try to fetch Bank Balances if stored)
    // Currently, `dashboard-data.ts` uses `bank.totalUSD` which comes from... well, it's aggregated.
    // Let's just list the Plazo Fijos for now, as that's the main "Bank" asset we track explicitly.
    // If the user has "Bank Accounts" stored as BankOperation with type 'CHECKING' or 'SAVINGS', we could list them.

    // Let's fetch ALL active bank ops
    const allOps = await prisma.bankOperation.findMany({
        where: { userId }
    });

    return {
        plazoFijos: activePFs.filter(pf => {
            // Check if active: startDate + duration > now? Or just list all recent?
            // List all that are not expired or expired recently?
            // Let's list ALL defined PFs for report completeness.
            return true;
        }),
        accounts: allOps.filter(op => op.type === 'CHECKING' || op.type === 'SAVINGS')
    };
}

export default async function PrintBankPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500">Unauthorized</div>;
    }

    const data = await getBankData(userId);

    const formatCurrency = (val: number, cur: string) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur }).format(val);

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold border-b pb-4">Reporte Bancario</h1>

            {/* Plazo Fijos */}
            <div className="print-card border rounded overflow-hidden">
                <div className="bg-slate-100 border-b p-3 font-bold text-sm uppercase text-slate-600">
                    Plazos Fijos
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-slate-50">
                            <th className="p-2 text-left">Banco / Alias</th>
                            <th className="p-2 text-center">TNA</th>
                            <th className="p-2 text-center">Iniciado</th>
                            <th className="p-2 text-center">Vencimiento</th>
                            <th className="p-2 text-right">Monto</th>
                            <th className="p-2 text-right">Interés Ganado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.plazoFijos.map((pf) => {
                            const start = pf.startDate ? new Date(pf.startDate) : null;
                            const end = start ? new Date(start.getTime() + (pf.durationDays || 0) * 86400000) : null;
                            const interest = (pf.amount * (pf.tna || 0) / 100) * ((pf.durationDays || 0) / 365);

                            return (
                                <tr key={pf.id} className="border-b last:border-0">
                                    <td className="p-2 font-semibold">{pf.alias}</td>
                                    <td className="p-2 text-center">{pf.tna}%</td>
                                    <td className="p-2 text-center">{start?.toLocaleDateString()}</td>
                                    <td className="p-2 text-center text-slate-600">{end?.toLocaleDateString()}</td>
                                    <td className="p-2 text-right font-mono">{formatCurrency(pf.amount, pf.currency || 'ARS')}</td>
                                    <td className="p-2 text-right font-mono text-green-600">+{formatCurrency(interest, pf.currency || 'ARS')}</td>
                                </tr>
                            );
                        })}
                        {data.plazoFijos.length === 0 && (
                            <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin Plazos Fijos activos</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Accounts (Liquidity) */}
            <div className="print-card border rounded overflow-hidden">
                <div className="bg-slate-100 border-b p-3 font-bold text-sm uppercase text-slate-600">
                    Cuentas & Liquidez
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-slate-50">
                            <th className="p-2 text-left">Banco</th>
                            <th className="p-2 text-left">Tipo</th>
                            <th className="p-2 text-right">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.accounts.map((acc) => (
                            <tr key={acc.id} className="border-b last:border-0">
                                <td className="p-2 font-semibold">{acc.bankName}</td>
                                <td className="p-2 text-xs uppercase text-slate-500">{acc.type}</td>
                                <td className="p-2 text-right font-mono">{formatCurrency(acc.amount, acc.currency || 'ARS')}</td>
                            </tr>
                        ))}
                        {data.accounts.length === 0 && (
                            <tr><td colSpan={3} className="p-4 text-center text-slate-400">Sin cuentas registradas</td></tr>
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
