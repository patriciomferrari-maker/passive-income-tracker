import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell, LabelList } from 'recharts';
import { useEffect, useState } from 'react';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, ShoppingBag, Eye, EyeOff } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#3b82f6', '#8b5cf6'];

export function CostaDashboardTab() {
    const [data, setData] = useState<any>(null);
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        fetch('/api/costa/dashboard').then(res => res.json()).then(setData);
    }, []);

    if (!data) return <div className="p-10 text-center text-slate-500">Cargando dashboard...</div>;

    const { stats, chartData, expenseDistribution } = data;

    const formatUSD = (val: number) => showValues ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : '****';

    // Comparison Logic
    const diff = stats.lastMonthExpenses - stats.averageMonthlyExpenses;
    const isHigher = diff > 0;
    const isLower = diff < 0;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Dashboard General</h2>
                <button
                    onClick={() => setShowValues(!showValues)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    {showValues ? <div className="flex items-center gap-2"><Eye size={18} /> Ocultar Valores</div> : <div className="flex items-center gap-2"><EyeOff size={18} /> Mostrar Valores</div>}
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Ingresos Alquiler (Año) (USD)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-400">{formatUSD(stats.yearlyRentalIncomeUSD)}</div>
                        <p className="text-xs text-slate-500 mt-1">Total USD este año</p>
                    </CardContent>
                </Card>

                {/* Last Month Expenses */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Gastos Último Mes (USD)</CardTitle>
                        <DollarSign className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <div className="flex flex-col">
                                <div className="text-xl font-bold text-red-400">USD {formatUSD(stats.lastMonthExpensesSplit?.USD || 0).replace('USD', '').trim()}</div>
                                <div className="text-sm text-slate-400">ARS {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(stats.lastMonthExpensesSplit?.ARS || 0)}</div>
                            </div>
                            <div className="mb-1">
                                {showValues && isHigher && <div className="text-red-500 text-2xl font-bold">▲</div>}
                                {showValues && isLower && <div className="text-emerald-500 text-2xl font-bold">▼</div>}
                                {showValues && !isHigher && !isLower && <div className="text-slate-400 text-2xl font-bold">-</div>}
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 capitalize">{stats.lastMonthName || 'Sin datos'}</p>
                    </CardContent>
                </Card>

                {/* Average Expenses (Matched Color to Red/Orange) */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Promedio Gastos (USD)</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-400/80">{formatUSD(stats.averageMonthlyExpenses)}</div>
                        <p className="text-xs text-slate-500 mt-1">Promedio mensual histórico</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader><CardTitle className="text-white">Ingresos vs Gastos (USD)</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        {showValues ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        formatter={(value: number) => formatUSD(value)}
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        <LabelList dataKey="income" position="top" fill="#10b981" fontSize={12} formatter={(val: any) => val > 0 ? new Intl.NumberFormat('en-US').format(val) : ''} />
                                    </Bar>
                                    <Bar dataKey="expense" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        <LabelList dataKey="expense" position="top" fill="#ef4444" fontSize={12} formatter={(val: any) => val > 0 ? new Intl.NumberFormat('en-US').format(val) : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-600">
                                <div className="flex flex-col items-center gap-2">
                                    <EyeOff size={32} />
                                    <span>Gráfico oculto</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pie Chart (Expenses) */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader><CardTitle className="text-white">Distribución Gastos (Último Mes)</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        {showValues ? (
                            expenseDistribution && expenseDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={expenseDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = outerRadius + 20;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                                return (
                                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                                        {`${name} (${(percent * 100).toFixed(0)}%)`}
                                                    </text>
                                                );
                                            }}
                                            labelLine={{ stroke: '#64748b' }}
                                        >
                                            {expenseDistribution.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => formatUSD(value)}
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    No hay gastos registrados este mes
                                </div>
                            )
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-600">
                                <div className="flex flex-col items-center gap-2">
                                    <EyeOff size={32} />
                                    <span>Gráfico oculto</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
