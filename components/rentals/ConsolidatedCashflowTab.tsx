import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';

interface ConsolidatedCashflow {
    date: Date;
    ownerARS: number;
    ownerUSD: number;
    ownerTotalUSD: number;
    tenantARS: number;
    tenantUSD: number;
    tenantTotalUSD: number;
    count: number;
    months?: ConsolidatedCashflow[]; // Nested monthly data
}

export function ConsolidatedCashflowTab({ showValues = true }: { showValues?: boolean }) {
    const [cashflows, setCashflows] = useState<ConsolidatedCashflow[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'OWNER' | 'TENANT'>('ALL');
    const [loading, setLoading] = useState(true);
    const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const toggleYear = (year: number) => {
        const newExpanded = new Set(expandedYears);
        if (newExpanded.has(year)) {
            newExpanded.delete(year);
        } else {
            newExpanded.add(year);
        }
        setExpandedYears(newExpanded);
    };

    const loadData = async () => {
        try {
            const res = await fetch('/api/rentals/cashflows/consolidated');
            const data = await res.json();

            if (Array.isArray(data)) {
                // Group by Year
                const yearlyMap = data.reduce((acc: any, curr: ConsolidatedCashflow) => {
                    const year = new Date(curr.date).getFullYear();
                    if (!acc[year]) {
                        acc[year] = {
                            date: new Date(year, 0, 1),
                            ownerARS: 0,
                            ownerUSD: 0,
                            ownerTotalUSD: 0,
                            tenantARS: 0,
                            tenantUSD: 0,
                            tenantTotalUSD: 0,
                            count: 0,
                            months: []
                        };
                    }
                    // Aggregate fields
                    acc[year].ownerARS += curr.ownerARS;
                    acc[year].ownerUSD += curr.ownerUSD;
                    acc[year].ownerTotalUSD += curr.ownerTotalUSD;
                    acc[year].tenantARS += curr.tenantARS;
                    acc[year].tenantUSD += curr.tenantUSD;
                    acc[year].tenantTotalUSD += curr.tenantTotalUSD;

                    acc[year].count += curr.count;
                    acc[year].months.push(curr);
                    return acc;
                }, {});

                const sortedYears = Object.values(yearlyMap).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
                setCashflows(sortedYears as ConsolidatedCashflow[]);
            } else {
                console.error('Consolidated API returned non-array:', data);
                setCashflows([]);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setCashflows([]);
        } finally {
            setLoading(false);
        }
    };

    const hasTenantData = cashflows.some(c => c.tenantTotalUSD > 0);

    const getDisplayValues = (item: ConsolidatedCashflow) => {
        if (filter === 'OWNER') {
            return {
                ars: item.ownerARS,
                usd: item.ownerUSD,
                total: item.ownerTotalUSD
            };
        }
        if (filter === 'TENANT') {
            return {
                ars: item.tenantARS,
                usd: item.tenantUSD,
                total: item.tenantTotalUSD
            };
        }
        // ALL (Net = Owner - Tenant)
        return {
            ars: item.ownerARS - item.tenantARS,
            usd: item.ownerUSD - item.tenantUSD,
            total: item.ownerTotalUSD - item.tenantTotalUSD
        };
    };

    const grandTotal = cashflows.reduce((acc, curr) => ({
        ownerARS: acc.ownerARS + curr.ownerARS,
        ownerUSD: acc.ownerUSD + curr.ownerUSD,
        ownerTotalUSD: acc.ownerTotalUSD + curr.ownerTotalUSD,
        tenantARS: acc.tenantARS + curr.tenantARS,
        tenantUSD: acc.tenantUSD + curr.tenantUSD,
        tenantTotalUSD: acc.tenantTotalUSD + curr.tenantTotalUSD,
        count: acc.count + curr.count
    }), { ownerARS: 0, ownerUSD: 0, ownerTotalUSD: 0, tenantARS: 0, tenantUSD: 0, tenantTotalUSD: 0, count: 0 });

    const totalValues = getDisplayValues(grandTotal as ConsolidatedCashflow);

    return (
        <div className="space-y-6">

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <TrendingUp size={24} className="text-blue-500" />
                    Flujo Consolidado de Alquileres
                </h2>

                {/* Filter Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('OWNER')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'OWNER'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        Propietario
                    </button>
                    {(hasTenantData || filter === 'TENANT') && (
                        <button
                            onClick={() => setFilter('TENANT')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'TENANT'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                                }`}
                        >
                            Inquilino
                        </button>
                    )}
                    <button
                        onClick={() => setFilter('ALL')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'ALL'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        Consolidado
                    </button>
                </div>
            </div>

            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : cashflows.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay cashflows proyectados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-3 px-4 text-slate-300 w-10"></th>
                                        <th className="text-left py-3 px-4 text-slate-300">Período</th>
                                        <th className="text-right py-3 px-4 text-slate-300">Alq. ARS</th>
                                        <th className="text-right py-3 px-4 text-slate-300">Alq. USD</th>
                                        <th className="text-right py-3 px-4 text-emerald-400">Total USD</th>
                                        <th className="text-center py-3 px-4 text-slate-300"># Ctos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cashflows.map((cfYear, idx) => {
                                        const year = new Date(cfYear.date).getFullYear();
                                        const isExpanded = expandedYears.has(year);
                                        const vals = getDisplayValues(cfYear);

                                        return (
                                            <Fragment key={year}>
                                                {/* Year Row */}
                                                <tr
                                                    className="border-b border-slate-800 hover:bg-slate-900 cursor-pointer transition-colors"
                                                    onClick={() => toggleYear(year)}
                                                >
                                                    <td className="py-3 px-4 text-slate-400">
                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </td>
                                                    <td className="py-3 px-4 text-white font-bold text-sm">
                                                        {year}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${vals.ars < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                                        {showValues ? `$${vals.ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${vals.usd < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                                        {showValues ? `$${vals.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className={`py-3 px-4 text-right font-bold font-mono text-sm ${vals.total < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {showValues ? `$${vals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-slate-400">
                                                        {cfYear.count}
                                                    </td>
                                                </tr>

                                                {/* Monthly Rows */}
                                                {isExpanded && cfYear.months?.map((cfMonth, mIdx) => {
                                                    const mVals = getDisplayValues(cfMonth);
                                                    return (
                                                        <tr key={`month-${year}-${mIdx}`} className="border-b border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/50">
                                                            <td className="py-2 px-4"></td> {/* Indent */}
                                                            <td className="py-2 px-4 text-slate-400 text-sm pl-8 border-l-2 border-slate-800">
                                                                {new Date(cfMonth.date).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}
                                                            </td>
                                                            <td className={`py-2 px-4 text-right font-mono text-sm ${mVals.ars < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                                                {showValues ? `$${mVals.ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                                            </td>
                                                            <td className={`py-2 px-4 text-right font-mono text-sm ${mVals.usd < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                                                {showValues ? `$${mVals.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                                            </td>
                                                            <td className={`py-2 px-4 text-right font-mono text-sm ${mVals.total < 0 ? 'text-rose-400' : 'text-emerald-500/80'}`}>
                                                                {showValues ? `$${mVals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                                            </td>
                                                            <td className="py-2 px-4 text-center text-slate-600 text-sm">
                                                                {cfMonth.count}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 font-bold border-t-2 border-slate-700">
                                        <td></td>
                                        <td className="py-4 px-4 text-white text-sm">TOTAL HISTÓRICO</td>
                                        <td className={`py-4 px-4 text-right font-mono text-sm ${totalValues.ars < 0 ? 'text-rose-400' : 'text-white'}`}>
                                            {showValues ? `$${totalValues.ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className={`py-4 px-4 text-right font-mono text-sm ${totalValues.usd < 0 ? 'text-rose-400' : 'text-white'}`}>
                                            {showValues ? `$${totalValues.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className={`py-4 px-4 text-right font-mono text-sm ${totalValues.total < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {showValues ? `$${totalValues.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className="py-4 px-4 text-center text-slate-300">
                                            {grandTotal.count}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
