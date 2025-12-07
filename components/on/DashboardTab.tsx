'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Calendar, Percent, PieChart, Wallet, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LabelList } from 'recharts';

interface DashboardData {
    capitalInvertido: number;
    capitalCobrado: number;
    interesCobrado: number;
    capitalACobrar: number;
    interesACobrar: number;
    totalACobrar: number;
    roi: number;
    tirConsolidada: number;
    proximoPago: {
        date: string;
        amount: number;
        type: string;
        ticker: string;
        name: string;
    } | null;
    upcomingPayments: Array<{
        date: string;
        amount: number;
        type: string;
        ticker: string;
        name?: string;
    }>;
    portfolioBreakdown: Array<{
        ticker: string;
        name: string;
        invested: number;
        percentage: number;
        tir: number;
    }>;
    totalONs: number;
    totalTransactions: number;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function DashboardTab() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        loadDashboard();
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }

        const handlePrivacyChange = () => {
            const savedPrivacy = localStorage.getItem('privacy_mode');
            if (savedPrivacy !== null) {
                setShowValues(savedPrivacy === 'true');
            }
        };
        window.addEventListener('privacy-changed', handlePrivacyChange);
        return () => window.removeEventListener('privacy-changed', handlePrivacyChange);
    }, []);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
        window.dispatchEvent(new Event('privacy-changed'));
    };

    const loadDashboard = async () => {
        try {
            const res = await fetch('/api/investments/on/dashboard');
            const dashboardData = await res.json();
            setData(dashboardData);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number) => {
        if (!showValues) return '****';
        return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Calculate totals for upcoming payments
    const paymentTotals = useMemo(() => {
        if (!data) return { totalAmount: 0, totalInterest: 0, totalAmortization: 0 };

        const first10 = data.upcomingPayments.slice(0, 10);
        return {
            totalAmount: first10.reduce((sum, p) => sum + p.amount, 0),
            totalInterest: first10.filter(p => p.type === 'INTEREST').reduce((sum, p) => sum + p.amount, 0),
            totalAmortization: first10.filter(p => p.type === 'AMORTIZATION').reduce((sum, p) => sum + p.amount, 0)
        };
    }, [data]);

    if (loading) {
        return (
            <div className="text-slate-400 text-center py-12">Cargando dashboard...</div>
        );
    }

    if (!data) {
        return (
            <div className="text-slate-400 text-center py-12">Error al cargar el dashboard</div>
        );
    }

    // Prepare chart data - group by month and add total
    const chartData = data.upcomingPayments.reduce((acc, payment) => {
        const monthKey = format(new Date(payment.date), 'MMM yyyy', { locale: es });
        if (!acc[monthKey]) {
            acc[monthKey] = { month: monthKey, Interés: 0, Amortización: 0, Total: 0 };
        }
        if (payment.type === 'INTEREST') {
            acc[monthKey].Interés += payment.amount;
        } else {
            acc[monthKey].Amortización += payment.amount;
        }
        acc[monthKey].Total = acc[monthKey].Interés + acc[monthKey].Amortización;
        return acc;
    }, {} as Record<string, any>);

    // If hidden, show empty array for Bar Chart (empty axes)
    const chartDataArray = showValues ? Object.values(chartData).slice(0, 12) : [];

    // Prepare TIR chart data (Empty if hidden)
    const tirChartData = showValues ? data.portfolioBreakdown
        .map(item => ({
            ticker: item.ticker,
            tir: item.tir
        }))
        .sort((a, b) => b.tir - a.tir) : [];

    // Pie Chart Data (Dummy if hidden for empty ring)
    const pieChartData = showValues ? data.portfolioBreakdown : [{ ticker: 'Oculto', invested: 1, percentage: 100, tir: 0 }];
    const PIE_COLORS = showValues ? COLORS : ['#1e293b']; // Slate 800 for empty

    const cardClass = "bg-slate-950 border-slate-800";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard</h2>
                <button
                    onClick={togglePrivacy}
                    className="p-2 bg-slate-700 rounded-md text-slate-300 hover:text-white"
                    title={showValues ? "Ocultar montos" : "Mostrar montos"}
                >
                    {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>

            {/* HERO CARD: Unified Investment, TIR, and Next Payment */}
            <Card className="bg-slate-950 border-slate-800 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                    {/* Total Investment */}
                    <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-900/50 transition-colors">
                        <div className="mb-3 p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Inversión Total</p>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {formatMoney(data.capitalInvertido)}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {data.totalTransactions} operaciones activas
                        </p>
                    </div>

                    {/* Consolidated TIR */}
                    <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-900/50 transition-colors">
                        <div className="mb-3 p-3 rounded-full bg-blue-500/10 text-blue-500">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">TIR Consolidada</p>
                        <div className="text-3xl font-bold text-blue-400 tracking-tight">
                            {showValues ? `${data.tirConsolidada.toFixed(2)}%` : '****'}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Rendimiento anualizado
                        </p>
                    </div>

                    {/* Next Payment */}
                    <div className="p-6 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="mb-3 p-3 rounded-full bg-purple-500/10 text-purple-500 z-10">
                            <Clock className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1 z-10">Próximo Pago</p>

                        {data.proximoPago ? (
                            <div className="z-10">
                                <div className="text-3xl font-bold text-white tracking-tight mb-1">
                                    {formatMoney(data.proximoPago.amount)}
                                </div>
                                <div className="text-sm font-medium text-purple-300 mb-1">
                                    {data.proximoPago.ticker}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {format(new Date(data.proximoPago.date), 'dd MMMM yyyy', { locale: es })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500 z-10">Sin pagos próximos</div>
                        )}
                    </div>
                </div>
            </Card>

            {/* SECONDARY METRICS: Grid of 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Capital Cobrado */}
                <Card className="bg-slate-950 border-emerald-500/30 hover:border-emerald-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                                <ArrowDownRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">COBRADO</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Capital</p>
                            <div className="text-2xl font-bold text-white">{formatMoney(data.capitalCobrado)}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Interés Cobrado */}
                <Card className="bg-slate-950 border-emerald-500/30 hover:border-emerald-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                                <ArrowDownRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">COBRADO</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Interés</p>
                            <div className="text-2xl font-bold text-white">{formatMoney(data.interesCobrado)}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Capital a Cobrar */}
                <Card className="bg-slate-950 border-amber-500/30 hover:border-amber-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:text-amber-300 transition-colors">
                                <ArrowUpRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">PENDIENTE</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Capital</p>
                            <div className="text-2xl font-bold text-amber-100">{formatMoney(data.capitalACobrar)}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Interés a Cobrar */}
                <Card className="bg-slate-950 border-amber-500/30 hover:border-amber-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:text-amber-300 transition-colors">
                                <ArrowUpRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">PENDIENTE</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Interés</p>
                            <div className="text-2xl font-bold text-amber-100">{formatMoney(data.interesACobrar)}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Payments Chart */}
                <Card className={cardClass}>
                    <CardHeader>
                        <CardTitle className="text-white">Pagos Futuros</CardTitle>
                        <CardDescription className="text-slate-300">
                            Proyección mensual de cobros
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartDataArray} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#e2e8f0"
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        style={{ fill: '#e2e8f0', fontSize: '12px' }}
                                        hide={!showValues}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        tickFormatter={(value) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                        domain={[0, 'auto']}
                                        hide={!showValues}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(value: number) => formatMoney(value)}
                                    />
                                    <Legend />
                                    <Bar dataKey="Interés" stackId="a" fill="#22c55e" />
                                    <Bar dataKey="Amortización" stackId="a" fill="#3b82f6">
                                        <LabelList
                                            dataKey="Total"
                                            position="top"
                                            formatter={(value: any) => showValues ? `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''}
                                            style={{ fill: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Portfolio Breakdown */}
                <Card className={cardClass}>
                    <CardHeader>
                        <CardTitle className="text-white">Composición del Portfolio</CardTitle>
                        <CardDescription className="text-slate-300">
                            Distribución por ON
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                    <Pie
                                        data={pieChartData}
                                        dataKey="invested"
                                        nameKey="ticker"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={showValues ? (entry: any) => `${entry.payload.ticker} (${entry.payload.percentage.toFixed(1)}%)` : undefined}
                                        stroke="none"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    {showValues && (
                                        <>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                                itemStyle={{ color: '#e2e8f0' }}
                                                formatter={(value: number) => formatMoney(value)}
                                            />
                                            <Legend />
                                        </>
                                    )}
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2: TIR */}
            <div className="grid grid-cols-1 gap-6">
                <Card className={cardClass}>
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Percent className="h-5 w-5" />
                            TIR por Obligación Negociable
                        </CardTitle>
                        <CardDescription className="text-slate-300">
                            Tasa Interna de Retorno estimada para cada inversión
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={tirChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        stroke="#94a3b8"
                                        tickFormatter={(value) => `${value}%`}
                                        domain={[0, 'auto']}
                                        hide={!showValues}
                                    />
                                    <YAxis
                                        dataKey="ticker"
                                        type="category"
                                        stroke="#e2e8f0"
                                        width={60}
                                        style={{ fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(value: number) => [showValues ? `${value.toFixed(2)}%` : '****', 'TIR']}
                                        cursor={{ fill: '#ffffff10' }}
                                    />
                                    <Bar dataKey="tir" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                                        <LabelList
                                            dataKey="tir"
                                            position="right"
                                            formatter={(value: any) => showValues ? `${Number(value).toFixed(2)}%` : ''}
                                            style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming Payments Timeline */}
            <Card className={cardClass}>
                <CardHeader>
                    <CardTitle className="text-white">Próximos Pagos</CardTitle>
                    <CardDescription className="text-slate-300">
                        Cronograma detallado de cobros
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                {/* Totals Row */}
                                <tr className="bg-white/5 border-b border-white/10">
                                    <th className="text-left py-3 px-4 text-slate-300 font-bold">TOTALES</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium"></th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium"></th>
                                    <th className="text-right py-3 px-4 text-slate-300 font-bold font-mono text-lg">
                                        {formatMoney(paymentTotals.totalAmount)}
                                    </th>
                                </tr>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Ticker</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Concepto</th>
                                    <th className="text-right py-3 px-4 text-slate-300 font-medium">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.upcomingPayments.map((payment, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-3 px-4 text-white">
                                            {format(new Date(payment.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="py-3 px-4 text-white font-medium">
                                            {payment.ticker}
                                        </td>
                                        <td className="py-3 px-4 text-white">
                                            <span className={`px-2 py-1 rounded text-xs mr-2 ${payment.type === 'INTEREST'
                                                ? 'bg-green-500/20 text-green-300'
                                                : 'bg-blue-500/20 text-blue-300'
                                                }`}>
                                                {payment.type === 'INTEREST' ? 'INTERÉS' : 'AMORTIZACIÓN'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-white text-right font-mono">
                                            {formatMoney(payment.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
