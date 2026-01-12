'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, XAxis, YAxis, ComposedChart, Line, LineChart, LabelList } from 'recharts';
import { InstallmentsChart } from './InstallmentsChart';

export function DashboardTab() {
    const [viewMode, setViewMode] = useState<'history' | 'projected'>('history');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/barbosa/dashboard?view=${viewMode}`)
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [viewMode]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;
    if (!data || data.error) return <div className="text-center text-red-500 p-8">Error cargando datos: {data?.error || 'Unknown Error'}</div>;
    if (!data.kpis) return <div className="text-center text-slate-500">No data structure found</div>;

    const { kpis, trend, distribution } = data;

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-xl">
                    <p className="text-slate-300 font-bold mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-slate-400 capitalize">{entry.name}:</span>
                            <span className="text-white font-mono font-bold">
                                {entry.name === 'savingsRate' || entry.name === '% Ahorro'
                                    ? `${Math.round(entry.value)}%`
                                    : entry.name.includes('USD') || entry.name === 'savingsUSD'
                                        ? `US$${Math.round(entry.value).toLocaleString()}`
                                        : `$${entry.value.toLocaleString()}`}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Toggle */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Dashboard</h2>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Histórico
                    </button>
                    <button
                        onClick={() => setViewMode('projected')}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'projected' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Proyección (12m)
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-950 border-slate-900 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Ahorro Total (12m)</CardTitle>
                        <Wallet className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">US${Math.round(kpis.totalSavingsUSD12M).toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Acumulado últimos 12 meses</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-slate-900 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Promedio Ahorro/Mes</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">US${Math.round(kpis.avgSavingsUSD).toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Estimado mensual</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-slate-900 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Tasa de Ahorro (Mes)</CardTitle>
                        <DollarSign className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${kpis.lastMonthSavingsRate >= 20 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {Math.round(kpis.lastMonthSavingsRate)}%
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Del ingreso del último mes</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-slate-900 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Ahorro Último Mes</CardTitle>
                        <Wallet className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">US${Math.round(kpis.lastMonthSavingsUSD).toLocaleString()}</div>
                        <p className="text-xs text-slate-500 mt-1">Cierre del periodo actual</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Section: Trend + Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Trend Chart - Combined Income/Expense + Savings Rate */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-purple-500" />
                            Detalle Ingresos y Egresos (USD)
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={trend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis
                                        dataKey="shortDate"
                                        stroke="#475569"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    {/* Left Axis: Amounts */}
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#475569"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value / 1000}k`}
                                    />
                                    {/* Right Axis: Percentage */}
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#f59e0b"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        unit="%"
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.5 }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                    <Bar
                                        yAxisId="left"
                                        dataKey="incomeUSD"
                                        name="Ingresos"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                        barSize={20}
                                        isAnimationActive={false}
                                    >
                                        <LabelList dataKey="incomeUSD" position="top" formatter={(v: number) => v > 0 ? `$${(v / 1000).toFixed(1)}k` : ''} style={{ fill: '#10b981', fontSize: '10px', fontWeight: 'bold' }} />
                                    </Bar>

                                    <Bar
                                        yAxisId="left"
                                        dataKey="expenseUSD"
                                        name="Egresos"
                                        fill="#ef4444"
                                        radius={[4, 4, 0, 0]}
                                        barSize={20}
                                        isAnimationActive={false}
                                    >
                                        <LabelList dataKey="expenseUSD" position="top" formatter={(v: number) => v > 0 ? `$${(v / 1000).toFixed(1)}k` : ''} style={{ fill: '#ef4444', fontSize: '10px', fontWeight: 'bold' }} />
                                    </Bar>

                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="savingsRate"
                                        name="% Ahorro"
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        dot={{ fill: '#f59e0b', r: 4 }}
                                    >
                                        <LabelList dataKey="savingsRate" position="top" formatter={(val: number) => Math.round(val) + '%'} style={{ fill: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }} />
                                    </Line>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            Evolución Ingresos vs Egresos
                        </h3>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis
                                        dataKey="shortDate"
                                        stroke="#475569"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#475569"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value / 1000}k`}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.5 }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="incomeUSD" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                    <Bar dataKey="expenseUSD" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Distribution Chart */}
                <div className="space-y-6">

                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6">Top Gastos (Último Mes)</h3>
                        <div className="h-[200px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distribution.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-2 space-y-2">
                            {distribution.slice(0, 3).map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        <span className="text-slate-400 truncate max-w-[100px]">{item.name}</span>
                                    </div>
                                    <span className="text-white font-mono">US${Math.round(item.value).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Installments Chart Section - Bottom */}
            <div className="space-y-6 pt-6 border-t border-slate-900">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingDown className="h-6 w-6 text-blue-500" />
                    Análisis de Cuotas
                </h2>

                <div className="w-full h-[400px]">
                    <InstallmentsChart />
                </div>
            </div>
        </div>
    );
}
