import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

interface ConsolidatedCashflow {
    date: Date;
    incomeARS: number;
    incomeUSD: number;
    totalUSD: number;
    count: number;
    months?: ConsolidatedCashflow[]; // Nested monthly data
}

export function ConsolidatedCashflowTab({ showValues = true }: { showValues?: boolean }) {
    const [cashflows, setCashflows] = useState<ConsolidatedCashflow[]>([]);
    const [globalData, setGlobalData] = useState<any>(null);
    const [chartFilter, setChartFilter] = useState<'ALL' | 'OWNER' | 'TENANT'>('ALL');
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
            const [resCashflow, resGlobal] = await Promise.all([
                fetch('/api/rentals/cashflows/consolidated'),
                fetch('/api/rentals/global-dashboard')
            ]);

            const dataCashflow = await resCashflow.json();
            const dataGlobal = await resGlobal.json();

            setGlobalData(dataGlobal);

            if (Array.isArray(dataCashflow)) {
                // Group by Year
                const yearlyMap = dataCashflow.reduce((acc: any, curr: ConsolidatedCashflow) => {
                    const year = new Date(curr.date).getFullYear();
                    if (!acc[year]) {
                        acc[year] = {
                            date: new Date(year, 0, 1),
                            incomeARS: 0,
                            incomeUSD: 0,
                            totalUSD: 0,
                            count: 0,
                            months: []
                        };
                    }
                    acc[year].incomeARS += curr.incomeARS;
                    acc[year].incomeUSD += curr.incomeUSD;
                    acc[year].totalUSD += curr.totalUSD;
                    acc[year].count += curr.count;
                    acc[year].months.push(curr); // Store monthly data
                    return acc;
                }, {});

                const sortedYears = Object.values(yearlyMap).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
                setCashflows(sortedYears as ConsolidatedCashflow[]);
            } else {
                console.error('Consolidated API returned non-array:', dataCashflow);
                setCashflows([]);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setCashflows([]);
        } finally {
            setLoading(false);
        }
    };

    const grandTotal = cashflows.reduce((acc, curr) => ({
        incomeARS: acc.incomeARS + curr.incomeARS,
        incomeUSD: acc.incomeUSD + curr.incomeUSD,
        totalUSD: acc.totalUSD + curr.totalUSD,
        count: acc.count + curr.count
    }), { incomeARS: 0, incomeUSD: 0, totalUSD: 0, count: 0 });

    const hasExpenses = globalData?.history?.some((h: any) => (h.expenseUSD || 0) > 0);

    return (
        <div className="space-y-6">

            {/* Global Charts Section (Moved from Dashboard) */}
            {globalData && (
                <div className="mb-8 space-y-6">
                    {/* Header 'Flujo Consolidado' with Buttons */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp size={24} className="text-blue-500" />
                            Historico Global (Gráficos)
                        </h2>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setChartFilter('OWNER')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${chartFilter === 'OWNER'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                Propietario
                            </button>
                            {(hasExpenses || chartFilter === 'TENANT') && (
                                <button
                                    onClick={() => setChartFilter('TENANT')}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${chartFilter === 'TENANT'
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    Inquilino
                                </button>
                            )}
                            <button
                                onClick={() => setChartFilter('ALL')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${chartFilter === 'ALL'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                Consolidado
                            </button>
                        </div>
                    </div>

                    {/* Row 1: Income (Owner) */}
                    {(chartFilter === 'ALL' || chartFilter === 'OWNER') && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Income Bar Chart */}
                            <Card className="bg-slate-950 border-slate-800 lg:col-span-2 shadow-lg print:border-slate-300 print:bg-white">
                                <CardHeader>
                                    <CardTitle className="text-white print:text-slate-900">Evolución Ingresos Totales (USD)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={showValues ? globalData.history : []} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                                                <YAxis stroke="#10b981" tick={{ fill: '#10b981', fontSize: 12 }} tickFormatter={(value) => `$${value}`} width={60} />
                                                {showValues && (
                                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} formatter={(value: number) => [`$${Math.round(value)}`, 'Total USD']} labelStyle={{ color: '#94a3b8' }} />
                                                )}
                                                <Bar
                                                    dataKey="incomeUSD"
                                                    fill="#10b981"
                                                    radius={[4, 4, 0, 0]}
                                                    name="Ingreso Total"
                                                    label={{ position: 'top', fill: '#10b981', fontSize: 11, formatter: (value: number) => value > 0 ? `$${Math.round(value)}` : '' }}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Income Pie Chart */}
                            <Card className="bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-white print:text-slate-900 flex items-center gap-2">
                                        <PieChartIcon size={16} /> Distribución (Ingresos)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center p-4 flex-1">
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={showValues && globalData?.currencyDistribution?.owner ? [{ name: 'USD', value: globalData.currencyDistribution.owner.USD }, { name: 'ARS', value: globalData.currencyDistribution.owner.ARS }].filter((d: any) => d.value > 0) : [{ name: 'Sin datos', value: 1 }]}
                                                    cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={showValues ? 5 : 0} dataKey="value" stroke="none"
                                                >
                                                    {showValues && globalData?.currencyDistribution?.owner ? (
                                                        [{ name: 'USD', value: globalData.currencyDistribution.owner.USD }, { name: 'ARS', value: globalData.currencyDistribution.owner.ARS }].filter((d: any) => d.value > 0).map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.name === 'USD' ? '#10b981' : '#3b82f6'} />
                                                        ))
                                                    ) : (<Cell fill="#1e293b" />)}
                                                </Pie>
                                                {showValues && <Tooltip />}
                                                {showValues && <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />}
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Row 2: Expense (Tenant) */}
                    {hasExpenses && (chartFilter === 'ALL' || chartFilter === 'TENANT') && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Expense Bar Chart */}
                            <Card className="bg-slate-950 border-slate-800 lg:col-span-2 shadow-lg print:border-slate-300 print:bg-white">
                                <CardHeader>
                                    <CardTitle className="text-white print:text-slate-900 text-rose-400">Evolución Gastos Totales (USD)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={showValues ? globalData.history : []} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                                                <YAxis stroke="#fb7185" tick={{ fill: '#fb7185', fontSize: 12 }} tickFormatter={(value) => `$${value}`} width={60} />
                                                {showValues && (
                                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} formatter={(value: number) => [`$${Math.round(value)}`, 'Total USD']} labelStyle={{ color: '#94a3b8' }} />
                                                )}
                                                <Bar
                                                    dataKey="expenseUSD"
                                                    fill="#fb7185"
                                                    radius={[4, 4, 0, 0]}
                                                    name="Gasto Total"
                                                    label={{ position: 'top', fill: '#fb7185', fontSize: 11, formatter: (value: number) => value > 0 ? `$${Math.round(value)}` : '' }}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Expense Pie Chart */}
                            <Card className="bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-white print:text-slate-900 flex items-center gap-2 text-rose-400">
                                        <PieChartIcon size={16} /> Distribución (Gastos)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center p-4 flex-1">
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={showValues && globalData?.currencyDistribution?.tenant ? [{ name: 'USD', value: globalData.currencyDistribution.tenant.USD }, { name: 'ARS', value: globalData.currencyDistribution.tenant.ARS }].filter((d: any) => d.value > 0) : [{ name: 'Sin datos', value: 1 }]}
                                                    cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={showValues ? 5 : 0} dataKey="value" stroke="none"
                                                >
                                                    {showValues && globalData?.currencyDistribution?.tenant ? (
                                                        [{ name: 'USD', value: globalData.currencyDistribution.tenant.USD }, { name: 'ARS', value: globalData.currencyDistribution.tenant.ARS }].filter((d: any) => d.value > 0).map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.name === 'USD' ? '#10b981' : '#3b82f6'} />
                                                        ))
                                                    ) : (<Cell fill="#1e293b" />)}
                                                </Pie>
                                                {showValues && <Tooltip />}
                                                {showValues && <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />}
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            <h2 className="text-2xl font-bold text-white">Detalle Anual y Mensual</h2>
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
                                                    <td className="py-3 px-4 text-white font-bold text-lg">
                                                        {year}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-300 font-mono font-bold">
                                                        {showValues ? `$${cfYear.incomeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-300 font-mono font-bold">
                                                        {showValues ? `$${cfYear.incomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-emerald-400 font-bold font-mono text-lg">
                                                        {showValues ? `$${cfYear.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-slate-400">
                                                        {cfYear.count}
                                                    </td>
                                                </tr>

                                                {/* Monthly Rows */}
                                                {isExpanded && cfYear.months?.map((cfMonth, mIdx) => (
                                                    <tr key={`month-${year}-${mIdx}`} className="border-b border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/50">
                                                        <td className="py-2 px-4"></td> {/* Indent */}
                                                        <td className="py-2 px-4 text-slate-400 text-sm pl-8 border-l-2 border-slate-800">
                                                            {new Date(cfMonth.date).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-slate-500 font-mono text-sm">
                                                            {showValues ? `$${cfMonth.incomeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '****'}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-slate-500 font-mono text-sm">
                                                            {showValues ? `$${cfMonth.incomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-emerald-500/80 font-mono text-sm">
                                                            {showValues ? `$${cfMonth.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                        </td>
                                                        <td className="py-2 px-4 text-center text-slate-600 text-sm">
                                                            {cfMonth.count}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 font-bold border-t-2 border-slate-700">
                                        <td></td>
                                        <td className="py-4 px-4 text-white text-lg">TOTAL HISTÓRICO</td>
                                        <td className="py-4 px-4 text-right text-white font-mono text-lg">
                                            {showValues ? `$${grandTotal.incomeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className="py-4 px-4 text-right text-white font-mono text-lg">
                                            {showValues ? `$${grandTotal.incomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className="py-4 px-4 text-right text-emerald-400 font-mono text-lg">
                                            {showValues ? `$${grandTotal.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
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
