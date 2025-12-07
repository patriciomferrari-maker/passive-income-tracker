'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { DollarSign, Building2, Users, TrendingUp, PieChart as PieIcon } from 'lucide-react';

interface GlobalDashboardData {
    kpis: {
        totalProperties: number;
        activeContracts: number;
        occupancyRate: number;
        currentMonthlyRevenueUSD: number;
    };
    history: {
        date: string;
        monthLabel: string;
        totalUSD: number;
        contractCount: number;
    }[];
    currencyDistribution: {
        USD: number;
        ARS: number;
    };
}

export default function GlobalDashboardTab() {
    const [data, setData] = useState<GlobalDashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/rentals/global-dashboard')
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch global dashboard data', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="text-center py-10 text-slate-400">Cargando dashboard consolidado...</div>;
    }

    if (!data) {
        return <div className="text-center py-10 text-slate-400">No se pudieron cargar los datos.</div>;
    }

    const COLORS = ['#10b981', '#3b82f6']; // Emerald (USD), Blue (ARS)

    const pieData = [
        { name: 'USD', value: data.currencyDistribution.USD },
        { name: 'ARS', value: data.currencyDistribution.ARS }
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Dashboard Consolidado</h2>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">
                            Ingresos Mensuales
                        </CardTitle>
                        <DollarSign className="text-emerald-500" size={16} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.kpis.currentMonthlyRevenueUSD)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Estimado actual (USD)</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">
                            Ocupación
                        </CardTitle>
                        <Users className="text-blue-500" size={16} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {data.kpis.occupancyRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {data.kpis.activeContracts} contratos activos
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">
                            Propiedades
                        </CardTitle>
                        <Building2 className="text-indigo-500" size={16} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {data.kpis.totalProperties}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Total en cartera</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">
                            Ticket Promedio
                        </CardTitle>
                        <TrendingUp className="text-amber-500" size={16} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">
                            {data.kpis.activeContracts > 0
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(data.kpis.currentMonthlyRevenueUSD / data.kpis.activeContracts)
                                : '$0'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Por contrato activo</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main History Chart */}
                <Card className="bg-slate-950 border-slate-800 lg:col-span-2 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-white">Evolución Ingresos Totales (USD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                    <XAxis
                                        dataKey="monthLabel"
                                        stroke="#64748b"
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        tickMargin={10}
                                    />
                                    <YAxis
                                        stroke="#10b981"
                                        tick={{ fill: '#10b981', fontSize: 12 }}
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                        formatter={(value: number) => [`$${Math.round(value)}`, 'Total USD']}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Bar dataKey="totalUSD" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingreso Total" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Currency Distribution Pie */}
                <Card className="bg-slate-950 border-slate-800 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <PieIcon size={16} /> Distribución Moneda
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                        formatter={(value: number, name: string) => [`${value} Contratos`, name]}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 text-center">
                            <p className="text-sm text-slate-400">
                                Total Contratos Activos: <span className="text-white font-bold">{data.kpis.activeContracts}</span>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
