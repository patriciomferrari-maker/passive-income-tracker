
import { getDashboardStats } from '@/app/lib/dashboard-data';
import { DashboardCard } from '@/components/DashboardCard';
import { FlagARG, FlagUSA } from '@/components/ui/CountryFlags';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

// Print Dashboard Page - Formal Report Redesign
import { getDashboardStats } from '@/app/lib/dashboard-data';
import { FlagARG, FlagUSA } from '@/components/ui/CountryFlags';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
        return <div className="flex items-center justify-center h-screen text-red-500 font-bold">Unauthorized Access</div>;
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

    const today = new Date();
    const monthYear = format(today, 'MMMM yyyy', { locale: es });

    // CSS for Print Breaks
    const pageBreak = (
        <div style={{ breakAfter: 'page', height: '1px', width: '100%' }} className="print:block hidden" />
    );

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans print:p-0 p-8">
            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>

            {/* === COVER PAGE === */}
            <div className="min-h-[297mm] flex flex-col justify-between p-12 bg-slate-50 border-b print:border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-900 rounded-bl-full opacity-5 print:opacity-100" />

                <div className="mt-20 relative z-10">
                    <div className="inline-block px-4 py-1.5 bg-blue-100 text-blue-800 text-xs font-bold tracking-widest uppercase rounded mb-6">
                        Confidencial
                    </div>
                    <h1 className="text-5xl font-light text-slate-900 tracking-tight leading-tight mb-2">
                        Reporte Financiero<br /><span className="font-bold text-slate-900">Consolidado</span>
                    </h1>
                    <p className="text-2xl text-slate-500 capitalize">{monthYear}</p>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-20 relative z-10">
                    <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-lg">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Patrimonio Total Estimado</div>
                        <div className="text-3xl font-bold text-slate-900">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                                stats.on.totalInvested + stats.treasury.totalInvested + stats.bank.totalUSD + stats.debts.totalPending
                            )}
                        </div>
                    </div>
                    {shouldShow('barbosa') && (
                        <div className="p-6 bg-white border border-slate-200 shadow-sm rounded-lg">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Gastos del Mes ({stats.barbosa.monthName})</div>
                            <div className="text-3xl font-bold text-slate-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.barbosa.totalMonthly)}
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-xs text-slate-400 border-t pt-8">
                    Generado automáticamente el {today.toLocaleDateString()} a las {today.toLocaleTimeString()}
                </div>
            </div>

            {pageBreak}

            {/* === CONTENT PAGES === */}
            <div className="max-w-4xl mx-auto py-12 px-8 print:py-12 print:px-12">

                {/* 1. ARGENTINA PORTFOLIO */}
                {shouldShow('on') && (
                    <section className="mb-12 break-inside-avoid">
                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <FlagARG className="w-8 h-6 rounded shadow-sm" />
                            <h2 className="text-2xl font-bold text-slate-800">Cartera Argentina</h2>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mb-6">
                            <div className="bg-slate-50 p-4 rounded border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold uppercase">Total Invertido</div>
                                <div className="text-xl font-bold text-slate-900 mt-1">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.on.totalInvested)}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold uppercase">Activos</div>
                                <div className="text-xl font-bold text-slate-900 mt-1">{stats.on.count}</div>
                            </div>
                        </div>

                        {/* Simple Table simulation for print clarity */}
                        <div className="border rounded-lg overflow-hidden text-sm">
                            <table className="w-full">
                                <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold text-left">
                                    <tr>
                                        <th className="p-3">Detalle</th>
                                        <th className="p-3 text-right">Valorizado (USD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="p-3 border-t text-slate-600 italic">Detalle completo disponible en dashboard interactivo.</td>
                                        <td className="p-3 border-t text-right font-medium text-slate-900">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.on.totalInvested)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* 2. USA PORTFOLIO */}
                {shouldShow('treasury') && (
                    <section className="mb-12 break-inside-avoid">
                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <FlagUSA className="w-8 h-6 rounded shadow-sm" />
                            <h2 className="text-2xl font-bold text-slate-800">Cartera USA</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="bg-slate-50 p-4 rounded border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold uppercase">Total Invertido</div>
                                <div className="text-xl font-bold text-slate-900 mt-1">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.treasury.totalInvested)}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold uppercase">Inversiones</div>
                                <div className="text-xl font-bold text-slate-900 mt-1">{stats.treasury.count}</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 3. RENTALS */}
                {shouldShow('rentals') && (
                    <section className="mb-12 break-inside-avoid">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b pb-4">🏠 Gestión de Alquileres</h2>

                        <div className="bg-white border rounded-lg p-6 flex justify-between items-center mb-6 shadow-sm">
                            <div>
                                <div className="text-sm text-slate-500 font-bold uppercase tracking-wide">Ingreso Mensual Estimado</div>
                                <div className="text-3xl font-bold text-emerald-700 mt-2">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.rentals.totalIncome)}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-slate-900">{stats.rentals.count}</div>
                                <div className="text-xs text-slate-400 font-bold uppercase">Propiedades</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 4. LIQUIDITY & DEBT */}
                <section className="break-inside-avoid grid grid-cols-2 gap-8">
                    {shouldShow('bank') && (
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Liquidez Disponible</h3>
                            <div className="p-4 bg-sky-50 border border-sky-100 rounded-lg">
                                <div className="text-2xl font-bold text-sky-900">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.bank.totalUSD)}
                                </div>
                            </div>
                        </div>
                    )}

                    {shouldShow('debts') && (
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Deudas Netas</h3>
                            <div className={`p-4 border rounded-lg ${stats.debts.totalPending < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                <div className={`text-2xl font-bold ${stats.debts.totalPending < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.debts.totalPending)}
                                </div>
                                <div className="text-xs mt-1 opacity-70 font-semibold uppercase">
                                    {stats.debts.totalPending < 0 ? 'Saldo a Pagar' : 'Saldo a Favor'}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <div className="mt-12 text-center text-[10px] text-slate-300 uppercase tracking-widest">
                    Fin del Reporte
                </div>
            </div>
        </div>
    );
}
