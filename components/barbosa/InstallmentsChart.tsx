'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { Loader2 } from 'lucide-react';

export function InstallmentsChart() {
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/barbosa/installments')
            .then(res => res.json())
            .then(data => {
                prepareChartData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const prepareChartData = (plans: any[]) => {
        const monthlySum: Record<string, number> = {};

        plans.forEach(plan => {
            // Include ALL plans (Active + Finished) to show full history/evolution
            plan.transactions.forEach((tx: any) => {
                // We show all transactions that belong to an installment plan here

                const date = new Date(tx.date);
                const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                monthlySum[key] = (monthlySum[key] || 0) + tx.amount;
            });
        });

        // Convert to array and sort
        const chart = Object.keys(monthlySum).sort().map(key => {
            const [y, m] = key.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1, 1);
            return {
                name: format(date, 'MMM yy').toUpperCase(),
                date: key,
                amount: monthlySum[key]
            };
        });

        setChartData(chart);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;

    return (
        <Card className="bg-slate-950 border border-slate-900 rounded-xl p-6 shadow-lg h-full">
            <h3 className="text-lg font-bold text-white mb-6">Evolución de Cuotas (Total Mes)</h3>
            <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 30, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#475569"
                                tick={{ fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#475569"
                                tick={{ fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <RechartsTooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '8px' }}
                                itemStyle={{ color: '#60a5fa' }}
                                formatter={(val: number) => [`$${val.toLocaleString()}`, 'Total Cuotas']}
                            />
                            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                <LabelList
                                    dataKey="amount"
                                    position="top"
                                    formatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                                    style={{ fill: '#e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        No hay datos de cuotas registrados
                    </div>
                )}
            </div>
        </Card>
    );
}
