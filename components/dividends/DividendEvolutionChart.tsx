
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function DividendEvolutionChart() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetch('/api/dividends/stats')
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    setData(res.data);
                    setTotal(res.totalAllTime);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="h-[200px] w-full bg-slate-900/50 animate-pulse rounded-md" />;
    if (data.length === 0) return null;

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-base">Evolución de Cobros</CardTitle>
                    <span className="text-emerald-400 font-bold text-sm">
                        Total: USD {total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                </div>
                <CardDescription className="text-xs text-slate-400">
                    Dividendos cobrados en los últimos 24 meses
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <XAxis
                                dataKey="month"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickFormatter={(val) => val.substring(2)} // '2024-01' -> '24-01'
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                itemStyle={{ color: '#4ade80' }}
                                formatter={(value: number) => [`USD ${value.toFixed(2)}`, 'Cobrado']}
                                labelFormatter={(label) => `Mes: ${label}`}
                            />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.amount > 500 ? '#10b981' : '#3b82f6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
