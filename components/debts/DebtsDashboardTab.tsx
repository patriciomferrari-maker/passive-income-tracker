'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, User, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Label } from 'recharts';

interface TabProps {
    showValues?: boolean;
}

export function DebtsDashboardTab({ showValues = true }: TabProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const res = await fetch('/api/debts/dashboard');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-slate-400 text-center py-12">Cargando tablero...</div>;

    if (!data) return <div className="text-slate-400">No hay datos disponibles</div>;

    // Use USD totals by default, fallback to ARS if no USD
    const totals = data.totals['USD'] || data.totals['ARS'] || { lent: 0, repaid: 0, pending: 0 };
    const currency = data.totals['USD'] ? 'USD' : (data.totals['ARS'] ? 'ARS' : 'USD');

    // Define Colors
    const COLOR_REPAID = '#10b981'; // Emerald 500
    // Soft/Tenue Red for Pending - Matching the user's preference for less bright/harsh
    const COLOR_PENDING = '#ff8787';
    const COLOR_EMPTY = '#1e293b'; // Slate 800 for empty state

    // If showValues is false, we pass a dummy empty segment to show a "blank" ring, or just empty array.
    // User asked for "empty", likely meaning just the ring background or nothing.
    // Let's pass an empty array to be safe, creating an empty chart.
    // Or for better UI, a full grey ring? "que esten vacios".
    // If I pass data with value 1 and color grey, it looks like a placeholder.
    // If I pass empty array, Recharts might show nothing.
    // Let's try placeholder grey ring.
    const chartData = showValues ? [
        { name: 'Cobrado', value: totals.repaid },
        { name: 'Pendiente', value: totals.pending }
    ].filter(d => d.value > 0) : [{ name: 'Oculto', value: 1 }];

    const repaymentProgress = totals.lent > 0 ? (totals.repaid / totals.lent) * 100 : 0;

    const formatCurrency = (val: number) => {
        if (!showValues) return '****';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <DollarSign size={20} />
                            <span className="text-sm font-semibold uppercase tracking-wider">Total Prestado</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white">{formatCurrency(totals.lent)}</h3>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-emerald-500">
                            <CheckCircle size={20} />
                            <span className="text-sm font-semibold uppercase tracking-wider">Total Cobrado</span>
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(totals.repaid)}</h3>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2" style={{ color: COLOR_PENDING }}>
                            <AlertCircle size={20} />
                            <span className="text-sm font-semibold uppercase tracking-wider">Pendiente</span>
                        </div>
                        <h3 className="text-2xl font-bold" style={{ color: COLOR_PENDING }}>{formatCurrency(totals.pending)}</h3>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Debtor Progress List */}
                <Card className="bg-slate-950 border-slate-800 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-white">Estado por Deudor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.debtors.map((debtor: any) => (
                                <div key={debtor.debtId} className="bg-slate-900/50 p-4 rounded border border-slate-800">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-white flex items-center gap-2">
                                                <User size={16} className="text-slate-400" />
                                                {debtor.name}
                                            </h4>
                                            <p className="text-xs text-slate-500">
                                                Prestado: {formatCurrency(debtor.amount)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold" style={{ color: COLOR_PENDING }}>
                                                Restan: {formatCurrency(debtor.pending)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 mb-1">
                                        <div
                                            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                            // Ensure width is 0 if values are hidden
                                            style={{ width: showValues ? `${debtor.progress}%` : '0%' }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        {showValues ? (
                                            <span>{debtor.progress.toFixed(1)}% Pagado</span>
                                        ) : (
                                            <span>Programando cobro...</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {data.debtors.length === 0 && (
                                <p className="text-slate-500 text-center py-4">No hay deudores activos.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Progreso General</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={showValues ? 5 : 0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={showValues
                                                ? (entry.name === 'Cobrado' ? COLOR_REPAID : COLOR_PENDING)
                                                : COLOR_EMPTY
                                            }
                                        />
                                    ))}
                                    <Label
                                        value={showValues ? `${repaymentProgress.toFixed(1)}%` : '****'}
                                        position="center"
                                        className="fill-white font-bold text-xl"
                                        style={{ fontSize: '24px', fill: '#475569', fontWeight: 'bold' }} // dimmed color for ****
                                    />
                                </Pie>
                                {showValues && (
                                    <>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                            itemStyle={{ color: '#f8fafc' }}
                                            formatter={(val: number) => formatCurrency(val)}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </>
                                )}
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
