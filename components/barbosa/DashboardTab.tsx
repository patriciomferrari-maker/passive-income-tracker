'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, PiggyBank } from 'lucide-react';
import { CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, XAxis, YAxis, ComposedChart, Line, AreaChart, Area, LabelList, LineChart } from 'recharts';
import { InstallmentsChart } from './InstallmentsChart';

export function DashboardTab() {
    const [viewMode, setViewMode] = useState<'history' | 'projected'>('history');
    const [currency, setCurrency] = useState<'USD' | 'ARS'>('ARS'); // Default to ARS
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

    const { kpis, trend, categoryTrend, topCategories, distribution } = data;

    // Filter for Nov 2025+ (for Savings Evolution Chart)
    const savingsTrend = trend.filter((d: any) => {
        const itemDate = new Date(d.date);
        const cutoffDate = new Date('2025-11-01');
        return itemDate >= cutoffDate;
    });

    // Filter category trend for Nov 2025+
    const filteredCategoryTrend = categoryTrend ? categoryTrend.filter((d: any) => {
        const itemDate = new Date(d.date);
        const cutoffDate = new Date('2025-11-01');
        return itemDate >= cutoffDate;
    }) : [];

    console.log('🟢 ALL TREND DATA:', trend);
    console.log('🟢 FILTERED SAVINGS TREND (Nov 25+):', savingsTrend);
    console.log('🟢 Sample incomeUSD values:', savingsTrend.map(d => ({ period: d.period, incomeUSD: d.incomeUSD })));

    // Custom Tooltip for Charts
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
                    <p className="text-slate-300 font-medium mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-slate-400">{entry.name}:</span>
                            <span className="text-white font-semibold">
                                {entry.name === '% Ahorro'
                                    ? `${Math.round(entry.value)}%`
                                    : `$${entry.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
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
            {/* Header / Toggles */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Dashboard</h2>
                <div className="flex gap-3">
                    {/* Currency Toggle */}
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button
                            onClick={() => setCurrency('USD')}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${currency === 'USD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            USD
                        </button>
                        <button
                            onClick={() => setCurrency('ARS')}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${currency === 'ARS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            ARS
                        </button>
                    </div>
                    {/* View Toggle */}
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

                {/* Savings Evolution Chart (Nov 2025+) */}
                <div className="lg:col-span-3">
                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            Evolución Ingresos y Ahorro (Desde Nov '25)
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={savingsTrend}
                                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                                    barCategoryGap={0}
                                >
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
                                        stroke="#10b981"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.6)]}
                                        tickFormatter={(value) => `$${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}k`}
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

                                    {/* Green Bars: Income */}
                                    <Bar
                                        yAxisId="left"
                                        dataKey={currency === 'USD' ? 'incomeUSD' : 'income'}
                                        name="Ingresos"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                        barSize={32}
                                        isAnimationActive={false}
                                    >
                                        <LabelList
                                            dataKey={currency === 'USD' ? 'incomeUSD' : 'income'}
                                            position="top"
                                            formatter={(v: number) => v > 0 ? `$${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}k` : ''}
                                            style={{ fill: '#10b981', fontSize: '9px', fontWeight: 'bold' }}
                                        />
                                    </Bar>

                                    {/* Red Bars: Expenses */}
                                    <Bar
                                        yAxisId="left"
                                        dataKey={currency === 'USD' ? 'expenseUSD' : 'expense'}
                                        name="Egresos"
                                        fill="#ef4444"
                                        radius={[4, 4, 0, 0]}
                                        barSize={32}
                                        isAnimationActive={false}
                                    >
                                        <LabelList
                                            dataKey={currency === 'USD' ? 'expenseUSD' : 'expense'}
                                            position="top"
                                            formatter={(v: number) => v > 0 ? `$${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}k` : ''}
                                            style={{ fill: '#ef4444', fontSize: '9px', fontWeight: 'bold' }}
                                        />
                                    </Bar>

                                    {/* Yellow Line: Savings % */}
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="savingsRate"
                                        name="% Ahorro"
                                        stroke="#f59e0b"
                                        strokeWidth={3}
                                        dot={{ fill: '#f59e0b', r: 5 }}
                                        activeDot={{ r: 7 }}
                                    >
                                        <LabelList
                                            dataKey="savingsRate"
                                            position="top"
                                            offset={10}
                                            formatter={(val: number) => Math.round(val) + '%'}
                                            style={{ fill: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}
                                        />
                                    </Line>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Category Evolution Chart - NEW */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-blue-500" />
                            Evolución de Gastos por Categoría
                        </h3>
                        <div className="h-[300px] w-full">
                            {filteredCategoryTrend && filteredCategoryTrend.length > 0 && topCategories ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={filteredCategoryTrend} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                                        <defs>
                                            {topCategories.map((cat: string, idx: number) => (
                                                <linearGradient key={`gradient-${cat}`} id={`gradient-${cat}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.4} />
                                                </linearGradient>
                                            ))}
                                        </defs>
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
                                            tickFormatter={(value) => `$${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}k`}
                                        />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1 }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        {topCategories.map((cat: string, idx: number) => (
                                            <Area
                                                key={cat}
                                                type="monotone"
                                                dataKey={currency === 'USD' ? cat : `${cat}_ARS`}
                                                name={cat}
                                                stackId="1"
                                                stroke={COLORS[idx % COLORS.length]}
                                                strokeWidth={2}
                                                fill={`url(#gradient-${cat})`}
                                                fillOpacity={1}
                                            >
                                                <LabelList
                                                    dataKey={currency === 'USD' ? cat : `${cat}_ARS`}
                                                    position="center"
                                                    formatter={(v: number) => v > 100 ? `$${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}k` : ''}
                                                    style={{ fill: '#ffffff', fontSize: '10px', fontWeight: 'bold', textShadow: '0 0 3px rgba(0,0,0,0.8)' }}
                                                />
                                            </Area>
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">No hay datos de categorías</div>
                            )}
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
