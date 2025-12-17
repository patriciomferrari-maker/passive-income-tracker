'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';

export function DashboardTab() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/barbosa/dashboard')
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;
    if (!data || data.error) return <div className="text-center text-red-500 p-8">Error cargando datos: {data?.error || 'Unknown Error'}</div>;
    if (!data.kpis) return <div className="text-center text-slate-500">No data structure found</div>;

    const { kpis, trend, distribution, recentActivity } = data;

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
                                {entry.name.includes('USD') || entry.name === 'savingsUSD'
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

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Trend Chart - Costa vs Others */}
                <div className="lg:col-span-2 bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-purple-500" />
                        Gastos: Costa Esmeralda vs Resto (USD)
                    </h3>
                    <div className="h-[300px] w-full">
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
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.5 }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar
                                    dataKey="expenseOtherUSD"
                                    name="Otros Gastos"
                                    stackId="a"
                                    fill="#64748b"
                                    radius={[0, 0, 4, 4]}
                                />
                                <Bar
                                    dataKey="expenseCostaUSD"
                                    name="Costa Esmeralda"
                                    stackId="a"
                                    fill="#22d3ee"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Chart */}
                <div className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-6">Top Gastos (Último Mes)</h3>
                    <div className="h-[300px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
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
                        {/* Legend Overlay */}
                        <div className="absolute bottom-0 w-full flex flex-col justify-center items-center gap-2 pointer-events-none">
                            <div className="text-xs text-slate-500">Distribución de mes actual</div>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {distribution.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                    <span className="text-slate-400">{item.name}</span>
                                </div>
                                <span className="text-white font-mono">US${Math.round(item.value).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <Card className="bg-slate-950 border-slate-900">
                <CardHeader>
                    <CardTitle className="text-lg text-white">Actividad Reciente</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentActivity.map((tx: any) => (
                            <div key={tx.id} className="flex items-center justify-between border-b border-slate-900 pb-4 last:border-0 last:pb-0">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {tx.type === 'INCOME' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{tx.category}</p>
                                        <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-mono font-bold ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-white'}`}>
                                        {tx.type === 'EXPENSE' ? '-' : '+'}${Math.abs(tx.amount).toLocaleString()}
                                    </p>
                                    {tx.amountUSD && (
                                        <p className="text-xs text-slate-500 font-mono">
                                            US${Math.round(Math.abs(tx.amountUSD)).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
