
import { getDashboardStats } from '@/app/lib/dashboard-data';
import { DashboardCard } from '@/components/DashboardCard';
import { FlagARG, FlagUSA } from '@/components/ui/CountryFlags';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

export default async function PrintDashboardPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    // Security Check
    if (secret !== process.env.CRON_SECRET) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500 font-bold">
                Unauthorized Access
            </div>
        );
    }

    let stats;
    try {
        stats = await getDashboardStats(userId);
    } catch (e) {
        return <div className="p-10 text-red-500">Error loading data: {(e as any).message}</div>;
    }

    if (!stats) return notFound();

    const { enabledSections } = stats;
    const showAll = !enabledSections || enabledSections.length === 0;
    const shouldShow = (id: string) => showAll || enabledSections!.includes(id);

    return (
        <div className="min-h-screen bg-white text-slate-900 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center border-b pb-6 border-slate-200">
                    <h1 className="text-3xl font-bold text-slate-800">Resumen Financiero</h1>
                    <p className="text-slate-500 mt-1">Generated automatically on {new Date().toLocaleDateString()}</p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-6">
                    {/* Reuse Dashboard Cards but wrapper in a print-friendly container */}
                    {shouldShow('on') && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <FlagARG className="w-8 h-6 rounded shadow-sm" /> Cartera Argentina
                            </h3>
                            <div className="text-2xl font-bold text-slate-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.on.totalInvested)}
                            </div>
                            <div className="text-sm text-slate-500">{stats.on.count} Activos</div>
                        </div>
                    )}

                    {shouldShow('treasury') && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <FlagUSA className="w-8 h-6 rounded shadow-sm" /> Cartera USA
                            </h3>
                            <div className="text-2xl font-bold text-slate-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.treasury.totalInvested)}
                            </div>
                            <div className="text-sm text-slate-500">{stats.treasury.count} Activos</div>
                        </div>
                    )}

                    {shouldShow('rentals') && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-bold text-lg mb-2">🏢 Alquileres</h3>
                            <div className="text-2xl font-bold text-slate-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.rentals.totalIncome)}
                            </div>
                            <div className="text-sm text-slate-500">{stats.rentals.count} Propiedades</div>
                        </div>
                    )}

                    {shouldShow('bank') && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-bold text-lg mb-2">🏦 Banco / Liquidez</h3>
                            <div className="text-2xl font-bold text-slate-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.bank.totalUSD)}
                            </div>
                            <div className="text-sm text-slate-500">Saldo Disponible</div>
                        </div>
                    )}

                    {shouldShow('debts') && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-bold text-lg mb-2">💸 Deudas Netas</h3>
                            <div className={`text-2xl font-bold ${stats.debts.totalPending < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.debts.totalPending)}
                            </div>
                            <div className="text-sm text-slate-500">{stats.debts.count} Cuentas</div>
                        </div>
                    )}

                    {shouldShow('barbosa') && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-bold text-lg mb-2">🏠 Gastos Hogar ({stats.barbosa.monthName})</h3>
                            <div className="text-2xl font-bold text-slate-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.barbosa.totalMonthly)}
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-center text-xs text-slate-400 pt-8">
                    Passive Income Tracker • Private & Confidential
                </div>
            </div>
        </div>
    );
}
