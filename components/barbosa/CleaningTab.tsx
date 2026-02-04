
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Bar } from 'recharts';

export function CleaningTab() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [inputMonth, setInputMonth] = useState<string>((new Date().getMonth() + 1).toString());
    const [inputYear, setInputYear] = useState<string>(new Date().getFullYear().toString());
    const [inputPrice, setInputPrice] = useState<string>('');
    const [inputHours, setInputHours] = useState<string>('4');

    const fetchData = () => {
        setLoading(true);
        fetch('/api/barbosa/cleaning')
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async () => {
        if (!inputPrice) {
            alert('Ingresa el precio por hora');
            return;
        }

        try {
            const res = await fetch('/api/barbosa/cleaning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: parseInt(inputMonth),
                    year: parseInt(inputYear),
                    pricePerHour: parseFloat(inputPrice),
                    hoursPerWeek: parseInt(inputHours)
                })
            });

            if (res.ok) {
                // alert('Datos guardados');
                fetchData(); // Refresh
            } else {
                alert('Error al guardar');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;

    const { chartData, tableData } = data || { chartData: [], tableData: [] };
    const lastPoint = tableData.length > 0 ? tableData[0] : null; // Newest is at 0 index in tableData

    // Insight Logic from last point
    const delta = lastPoint ? lastPoint.delta : 0;
    const isLagging = delta < -2; // Tolerance -2%

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🧹 Personal de Limpieza
            </h2>

            {/* Insight Card */}
            {lastPoint && (
                <div className={`p-4 rounded-xl border ${isLagging ? 'bg-red-950/30 border-red-800' : 'bg-emerald-950/30 border-emerald-800'}`}>
                    <div className="flex items-start gap-3">
                        {isLagging ? <AlertTriangle className="text-red-500 mt-1" /> : <CheckCircle className="text-emerald-500 mt-1" />}
                        <div>
                            <h3 className={`font-bold ${isLagging ? 'text-red-400' : 'text-emerald-400'}`}>
                                {isLagging ? 'Desfasaje detectado' : 'Ajuste adecuado'}
                            </h3>
                            <p className="text-slate-300 text-sm mt-1">
                                Tu ajuste acumulado vs Base es <span className="font-bold text-white">{lastPoint.accumPriceGrowth.toFixed(1)}%</span>.
                                La inflación acumulada es <span className="font-bold text-white">{lastPoint.ipcAccum.toFixed(1)}%</span>.
                                Diferencia: <span className={delta > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{delta > 0 ? '+' : ''}{delta.toFixed(1)} pts</span>.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Card */}
                <Card className="bg-slate-950 border-slate-900 shadow-lg h-fit">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-400">Cargar Precio Hora</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-500">Mes</label>
                                <Select value={inputMonth} onValueChange={setInputMonth}>
                                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <SelectItem key={m} value={m.toString()}>{new Date(2024, m - 1).toLocaleString('es-ES', { month: 'long' })}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Año</label>
                                <Select value={inputYear} onValueChange={setInputYear}>
                                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2024">2024</SelectItem>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Precio por Hora ($)</label>
                            <Input
                                type="number"
                                className="bg-slate-900 border-slate-800 text-white"
                                value={inputPrice}
                                onChange={e => setInputPrice(e.target.value)}
                                placeholder="Ej: 3500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Horas Semanales</label>
                            <Input
                                type="number"
                                className="bg-slate-900 border-slate-800 text-white"
                                value={inputHours}
                                onChange={e => setInputHours(e.target.value)}
                            />
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSave}>
                            Guardar
                        </Button>
                    </CardContent>
                </Card>

                {/* Chart Section */}
                <div className="lg:col-span-2">
                    <Card className="bg-slate-950 border-slate-900 shadow-lg h-full">
                        <CardHeader>
                            <CardTitle className="text-slate-400">Crecimiento Acumulado (%)</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis
                                            dataKey="period"
                                            stroke="#475569"
                                            tick={{ fontSize: 12 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            stroke="#475569"
                                            tick={{ fontSize: 12 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val) => `${val}%`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Legend />

                                        <Line
                                            type="monotone"
                                            dataKey="accumIPC"
                                            name="Inflación Acumulada"
                                            stroke="#f43f5e"
                                            strokeDasharray="5 5"
                                            strokeWidth={2}
                                            dot={false}
                                        />

                                        <Line
                                            type="monotone"
                                            dataKey="accumPriceGrowth"
                                            name="Ajuste Precio"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            activeDot={{ r: 6 }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    Carga el primer mes para ver la evolución
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Detailed History Table */}
            <Card className="bg-slate-950 border-slate-900 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-400">Análisis Detallado</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3">Periodo</th>
                                    <th className="px-4 py-3 text-right">Precio Hora</th>
                                    <th className="px-4 py-3 text-right">Total Mes</th>
                                    <th className="px-4 py-3 text-right text-blue-400">Ajuste Mes %</th>
                                    <th className="px-4 py-3 text-right text-blue-400">Ajuste Acum %</th>
                                    <th className="px-4 py-3 text-right text-rose-400">IPC Mes</th>
                                    <th className="px-4 py-3 text-right text-rose-500">IPC Acum</th>
                                    <th className="px-4 py-3 text-right font-bold">Delta IPC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData && tableData.map((row: any) => (
                                    <tr key={row.period} className="border-b border-slate-800 hover:bg-slate-900/30">
                                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                                            {new Date(row.year, row.month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-white">
                                            ${row.pricePerHour.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300">
                                            ${row.totalMonthly.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-blue-400">
                                            {row.monthlyGrowth > 0 ? '+' : ''}{row.monthlyGrowth.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-blue-400 font-medium">
                                            {row.accumPriceGrowth > 0 ? '+' : ''}{row.accumPriceGrowth.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-rose-400">
                                            {row.ipcMonthly.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-rose-500 font-medium">
                                            {row.ipcAccum.toFixed(1)}%
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${row.delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)} pts
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
