'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InterannualData {
    date: string;
    inflacion: number | null;
    devaluacion: number | null;
}

export default function InterannualChart() {
    const [data, setData] = useState<InterannualData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/economic-data/interannual')
            .then(res => res.json())
            .then(result => {
                setData(result.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching interannual data:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">Cargando datos económicos...</div>
                </CardContent>
            </Card>
        );
    }

    if (data.length === 0) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">No hay datos disponibles</div>
                </CardContent>
            </Card>
        );
    }

    // Calculate latest values
    const latest = data[data.length - 1];
    const diff = (latest.devaluacion || 0) - (latest.inflacion || 0);

    return (
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Inflación vs Devaluación Interanual
                </CardTitle>
                <CardDescription className="text-slate-300">
                    Variación % en los últimos 12 meses
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="text-xs text-red-300 mb-1">Inflación Interanual</div>
                        <div className="text-2xl font-bold text-red-400">
                            {latest.inflacion ? `${latest.inflacion.toFixed(1)}%` : 'N/A'}
                        </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-xs text-blue-300 mb-1">Devaluación Interanual</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {latest.devaluacion ? `${latest.devaluacion.toFixed(1)}%` : 'N/A'}
                        </div>
                    </div>
                    <div className={`${diff > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'} border rounded-lg p-4`}>
                        <div className={`text-xs ${diff > 0 ? 'text-orange-300' : 'text-green-300'} mb-1`}>
                            {diff > 0 ? 'Devaluación Mayor' : 'Inflación Mayor'}
                        </div>
                        <div className={`text-2xl font-bold ${diff > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                            {Math.abs(diff).toFixed(1)}pp
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tickFormatter={(value) => format(new Date(value), 'MMM yy', { locale: es })}
                                style={{ fontSize: '12px' }}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                tickFormatter={(value) => `${value}%`}
                                style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#ffffff' }}
                                labelFormatter={(value) => format(new Date(value), 'MMMM yyyy', { locale: es })}
                                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="inflacion"
                                name="Inflación"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={{ fill: '#ef4444', r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="devaluacion"
                                name="Devaluación"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Info Note */}
                <div className="mt-4 text-xs text-slate-400 text-center">
                    Inflación: variación IPC vs 12 meses atrás | Devaluación: variación TC promedio mensual vs 12 meses atrás
                </div>
            </CardContent>
        </Card>
    );
}
