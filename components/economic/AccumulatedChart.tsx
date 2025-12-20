'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Line, Chart, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AccumulatedData {
    date: string;
    inflacionAcumulada: number;
    devaluacionAcumulada: number;
}

/**
 * Chart 1: Inflación y Devaluación Acumulada (extended scope)
 * Shows accumulated inflation vs devaluation with extended TC data to match IPC range
 */
export default function AccumulatedChart() {
    const [data, setData] = useState<AccumulatedData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/economic-data/accumulated')
            .then(res => res.json())
            .then(result => {
                setData(result.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching accumulated data:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">Cargando datos acumulados...</div>
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

    const latest = data[data.length - 1];

    return (
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Inflación vs Devaluación Acumulada
                </CardTitle>
                <CardDescription className="text-slate-300">
                    Variación % acumulada desde el primer registro disponible
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="text-xs text-red-300 mb-1">Inflación Acumulada</div>
                        <div className="text-2xl font-bold text-red-400">
                            {latest.inflacionAcumulada.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-xs text-blue-300 mb-1">Devaluación Acumulada</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {latest.devaluacionAcumulada.toFixed(1)}%
                        </div>
                    </div>
                    <div className={`${latest.devaluacionAcumulada > latest.inflacionAcumulada ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'} border rounded-lg p-4`}>
                        <div className={`text-xs ${latest.devaluacionAcumulada > latest.inflacionAcumulada ? 'text-orange-300' : 'text-green-300'} mb-1`}>
                            Diferencia
                        </div>
                        <div className={`text-2xl font-bold ${latest.devaluacionAcumulada > latest.inflacionAcumulada ? 'text-orange-400' : 'text-green-400'}`}>
                            {Math.abs(latest.devaluacionAcumulada - latest.inflacionAcumulada).toFixed(1)}pp
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                            <XAxis
                                dataKey="date"
                                stroke="#94a3b8"
                                tickFormatter={(value) => format(new Date(`${value}T12:00:00`), 'MMM yy', { locale: es })}
                                style={{ fontSize: '12px' }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
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
                                labelFormatter={(value) => format(new Date(`${value}T12:00:00`), 'MMMM yyyy', { locale: es })}
                                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="inflacionAcumulada"
                                name="Inflación Acumulada"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="devaluacionAcumulada"
                                name="Devaluación Acumulada"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 text-xs text-slate-400 text-center">
                    Inflación: variación % IPC acumulada desde el primer dato | Devaluación: variación % TC Blue acumulada desde el primer dato
                </div>
            </CardContent>
        </Card>
    );
}
