'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, User, TrendingUp, AlertCircle, CheckCircle, HandCoins, Wallet } from 'lucide-react';
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

    // Define Colors
    const COLOR_REPAID = '#10b981'; // Emerald 500
    const COLOR_PENDING_RED = '#ff8787'; // Soft Red
    const COLOR_PENDING_BLUE = '#60a5fa'; // Blue 400
    const COLOR_EMPTY = '#1e293b'; // Slate 800

    const formatCurrency = (val: number, currency: string = 'USD') => {
        if (!showValues) return '****';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    }

    const renderSection = (
        title: string,
        icon: any,
        totals: any,
        list: any[],
        listTitle: string,
        color: string,
        pendingColor: string
    ) => {
        const totalData = totals['USD'] || totals['ARS'] || { lent: 0, repaid: 0, pending: 0 };
        const currency = totals['USD'] ? 'USD' : (totals['ARS'] ? 'ARS' : 'USD');

        const chartData = showValues ? [
            { name: 'Cobrado', value: totalData.repaid },
            { name: 'Pendiente', value: totalData.pending }
        ].filter(d => d.value > 0) : [{ name: 'Oculto', value: 1 }];

        const repaymentProgress = totalData.lent > 0 ? (totalData.repaid / totalData.lent) * 100 : 0;

        return (
            <div className="space-y-6">
                {/* Section Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-lg bg-${color}-500/10`}>
                        {icon}
                    </div>
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-slate-400">
                                <DollarSign size={20} />
                                <span className="text-sm font-semibold uppercase tracking-wider">Total</span>
                            </div>
                            <h3 className="text-2xl font-bold text-white">{formatCurrency(totalData.lent, currency)}</h3>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-emerald-500">
                                <CheckCircle size={20} />
                                <span className="text-sm font-semibold uppercase tracking-wider">Pagado</span>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(totalData.repaid, currency)}</h3>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2" style={{ color: pendingColor }}>
                                <AlertCircle size={20} />
                                <span className="text-sm font-semibold uppercase tracking-wider">Pendiente</span>
                            </div>
                            <h3 className="text-2xl font-bold" style={{ color: pendingColor }}>{formatCurrency(totalData.pending, currency)}</h3>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* List */}
                    <Card className="bg-slate-950 border-slate-800 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-white">{listTitle}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {list.map((item: any) => (
                                    <div key={item.debtId} className="bg-slate-900/50 p-4 rounded border border-slate-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-white flex items-center gap-2">
                                                    <User size={16} className="text-slate-400" />
                                                    {item.name}
                                                </h4>
                                                <p className="text-xs text-slate-500">
                                                    Total: {formatCurrency(item.amount, item.currency)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-mono font-bold" style={{ color: pendingColor }}>
                                                    Restan: {formatCurrency(item.pending, item.currency)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-800 rounded-full h-2.5 mb-1">
                                            <div
                                                className="h-2.5 rounded-full transition-all duration-500"
                                                style={{
                                                    width: showValues ? `${item.progress}%` : '0%',
                                                    backgroundColor: COLOR_REPAID
                                                }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-400">
                                            {showValues ? (
                                                <span>{item.progress.toFixed(1)}% Pagado</span>
                                            ) : (
                                                <span>Oculto</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {list.length === 0 && (
                                    <p className="text-slate-500 text-center py-4">No hay registros.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pie Chart */}
                    <Card className="bg-slate-950 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Progreso</CardTitle>
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
                                                    ? (entry.name === 'Cobrado' ? COLOR_REPAID : pendingColor)
                                                    : COLOR_EMPTY
                                                }
                                            />
                                        ))}
                                        <Label
                                            value={showValues ? `${repaymentProgress.toFixed(1)}%` : '****'}
                                            position="center"
                                            className="fill-white font-bold text-xl"
                                            style={{ fontSize: '24px', fill: '#475569', fontWeight: 'bold' }}
                                        />
                                    </Pie>
                                    {showValues && (
                                        <>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                formatter={(val: number) => formatCurrency(val, currency)}
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
    };

    return (
        <div className="space-y-12">
            {/* Deudas a Cobrar (OWED_TO_ME) */}
            {renderSection(
                '💰 Deudas a Cobrar (Me Deben)',
                <HandCoins size={24} className="text-blue-500" />,
                data.owedToMe.totals,
                data.owedToMe.debtors,
                'Estado por Deudor',
                'blue',
                COLOR_PENDING_BLUE
            )}

            {/* Divider */}
            <div className="border-t border-slate-800 my-8"></div>

            {/* Deudas que Tengo (I_OWE) */}
            {renderSection(
                '💸 Deudas que Tengo (Yo Debo)',
                <Wallet size={24} className="text-red-500" />,
                data.iOwe.totals,
                data.iOwe.creditors,
                'Estado por Acreedor',
                'red',
                COLOR_PENDING_RED
            )}
        </div>
    );
}
