'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LineChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UVAEvolutionData {
    date: string;
    uva: number;
    uvaNormalized: number;           // UVA normalized to 100 at start
    tcBlueNormalized: number;        // TC Blue normalized to 100
    tcOficialNormalized: number;     // TC Oficial normalized to 100
    ipcNormalized: number;           // IPC accumulated normalized to 100
}

/**
 * Chart 3: UVA Evolution vs Exchange Rates and Inflation
 * Shows how UVA value evolved compared to TC Blue, TC Oficial, and IPC (all normalized to 100 at start)
 */
export default function UVAEvolutionChart() {
    const [data, setData] = useState<UVAEvolutionData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/economic-data/uva-evolution')
            .then(res => res.json())
            .then(result => {
                setData(result.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching UVA evolution data:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">Cargando evolución UVA...</div>
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
                    <LineChartIcon className="h-5 w-5" />
                    Evolución del Valor UVA
                </CardTitle>
                <CardDescription className="text-slate-300">
                    Comparación normalizada (Base 100 = {format(new Date(data[0].date), 'MMM yyyy', { locale: es })})
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                        <div className="text-xs text-emerald-300 mb-1">UVA</div>
                        <div className="text-xl font-bold text-emerald-400">
                            {latest.uvaNormalized.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-emerald-300/70 mt-1">
                            ${latest.uva.toFixed(2)} actual
                        </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-xs text-blue-300 mb-1">TC Blue</div>
                        <div className="text-xl font-bold text-blue-400">
                            {latest.tcBlueNormalized.toFixed(1)}
                        </div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="text-xs text-green-300 mb-1">TC Oficial</div>
                        <div className="text-xl font-bold text-green-400">
                            {latest.tcOficialNormalized.toFixed(1)}
                        </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="text-xs text-red-300 mb-1">IPC</div>
                        <div className="text-xl font-bold text-red-400">
                            {latest.ipcNormalized.toFixed(1)}
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
                                style={{ fontSize: '12px' }}
                                label={{ value: 'Base 100', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: '12px' } }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#ffffff' }}
                                labelFormatter={(value) => format(new Date(`${value}T12:00:00`), 'MMMM yyyy', { locale: es })}
                                formatter={(value: number, name: string) => [value.toFixed(1), name]}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="uvaNormalized"
                                name="UVA"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="tcBlueNormalized"
                                name="TC Blue"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="tcOficialNormalized"
                                name="TC Oficial"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 5"
                            />
                            <Line
                                type="monotone"
                                dataKey="ipcNormalized"
                                name="Inflación (IPC)"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="3 3"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 text-xs text-slate-400 text-center">
                    Todas las series normalizadas a base 100 en {format(new Date(data[0].date), 'MMMM yyyy', { locale: es })} para comparar evolución relativa
                </div>
            </CardContent>
        </Card>
    );
}
