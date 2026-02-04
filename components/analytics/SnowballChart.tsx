'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

interface SnowballData {
    month: string;
    interest: number;
    dividends: number;
    pf: number;
    total: number;
    accumulated: number;
}

export function SnowballChart() {
    const [data, setData] = useState<SnowballData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/snowball')
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
    if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-500">No hay datos suficientes</div>;

    return (
        <div className="w-full h-[400px] bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                ❄️ Bola de Nieve <span className="text-xs font-normal text-slate-400">(Intereses Acumulados)</span>
            </h3>

            <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorAccumulated" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="month"
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(val) => val.slice(2)} // '24-01'
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(val) => `$${val}`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(value: number) => [`$${value.toFixed(0)}`, '']}
                        />
                        <Legend />

                        {/* Area de Acumulado (Total Snowball) */}
                        <Area
                            type="monotone"
                            dataKey="accumulated"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorAccumulated)"
                            name="Total Acumulado"
                            strokeWidth={3}
                        />

                        {/* Barras/Lineas discretas por mes (Optional context) */}
                        {/* We could use ComposedChart to mix bars (monthly) and area (accumulated), but keep simple for now */}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
