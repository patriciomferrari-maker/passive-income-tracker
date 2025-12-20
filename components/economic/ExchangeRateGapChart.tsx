'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExchangeRateData {
    date: string;
    tcOficial: number;
    tcBlue: number;
    brecha: number; // percentage gap
}

/**
 * Chart 2: TC Oficial vs TC Blue (sell price) + Gap
 * Shows official vs blue dollar with gap percentage on secondary axis
 */
export default function ExchangeRateGapChart() {
    const [data, setData] = useState<ExchangeRateData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/economic-data/exchange-gap')
            .then(res => res.json())
            .then(result => {
                setData(result.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching exchange rate gap data:', err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">Cargando tipos de cambio...</div>
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
                    <DollarSign className="h-5 w-5" />
                    Dólar Oficial vs Blue y Brecha
                </CardTitle>
                <CardDescription className="text-slate-300">
                    TC Vendedor (Oficial y Blue) con brecha % en eje secundario
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="text-xs text-green-300 mb-1">TC Oficial (Venta)</div>
                        <div className="text-2xl font-bold text-green-400">
                            ${latest.tcOficial.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-xs text-blue-300 mb-1">TC Blue (Venta)</div>
                        <div className="text-2xl font-bold text-blue-400">
                            ${latest.tcBlue.toFixed(2)}
                        </div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                        <div className="text-xs text-orange-300 mb-1">Brecha</div>
                        <div className="text-2xl font-bold text-orange-400">
                            {latest.brecha.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Chart with dual Y-axis */}
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 60, left: 20, bottom: 25 }}>
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
                            {/* Left Y-axis for TC values */}
                            <YAxis
                                yAxisId="left"
                                stroke="#94a3b8"
                                tickFormatter={(value) => `$${value}`}
                                style={{ fontSize: '12px' }}
                            />
                            {/* Right Y-axis for gap percentage */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="#fb923c"
                                tickFormatter={(value) => `${value}%`}
                                style={{ fontSize: '12px' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                itemStyle={{ color: '#ffffff' }}
                                labelStyle={{ color: '#ffffff' }}
                                labelFormatter={(value) => format(new Date(`${value}T12:00:00`), 'dd MMM yyyy', { locale: es })}
                                formatter={(value: number, name: string) => {
                                    if (name === 'Brecha') return [`${value.toFixed(1)}%`, name];
                                    return [`$${value.toFixed(2)}`, name];
                                }}
                            />
                            <Legend />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="tcOficial"
                                name="TC Oficial"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="tcBlue"
                                name="TC Blue"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="brecha"
                                name="Brecha"
                                stroke="#fb923c"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 text-xs text-slate-400 text-center">
                    TC Oficial: dato BCRA | TC Blue: precio vendedor de Ámbito | Brecha: ((Blue - Oficial) / Oficial) * 100
                </div>
            </CardContent>
        </Card>
    );
}
