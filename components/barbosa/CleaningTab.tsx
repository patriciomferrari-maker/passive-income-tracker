
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

    const { chartData, rawData } = data || { chartData: [], rawData: [] };
    const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

    // Determine Gap (Lag)
    const gap = lastPoint ? ((lastPoint.pricePerHour - lastPoint.theoreticalPrice) / lastPoint.theoreticalPrice) * 100 : 0;
    const isLagging = gap < -5; // If gap is worse than -5% (paid is 5% less than theoretical)
    const isGood = gap >= -5;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🧹 Personal de Limpieza
            </h2>

            {/* Insight Card */}
            {lastPoint && lastPoint.pricePerHour && (
                <div className={`p-4 rounded-xl border ${isLagging ? 'bg-red-950/30 border-red-800' : 'bg-emerald-950/30 border-emerald-800'}`}>
                    <div className="flex items-start gap-3">
                        {isLagging ? <AlertTriangle className="text-red-500 mt-1" /> : <CheckCircle className="text-emerald-500 mt-1" />}
                        <div>
                            <h3 className={`font-bold ${isLagging ? 'text-red-400' : 'text-emerald-400'}`}>
                                {isLagging ? 'Desfasaje detectado' : 'Precio Actualizado'}
                            </h3>
                            <p className="text-slate-300 text-sm mt-1">
                                Tu precio actual es <b>${lastPoint.pricePerHour.toLocaleString()}</b>.
                                Según la inflación acumulada, deberías estar pagando <b>${Math.round(lastPoint.theoreticalPrice).toLocaleString()}</b>.
                                Diferencia: <span className={gap > 0 ? 'text-emerald-400' : 'text-red-400'}>{gap > 0 ? '+' : ''}{Math.round(gap)}%</span>
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
                            <CardTitle className="text-slate-400">Evolución Precio vs Inflación</CardTitle>
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
                                            tickFormatter={(val) => `$${val}`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Legend />

                                        {/* Theoretical Price (Area/Line) */}
                                        <Line
                                            type="monotone"
                                            dataKey="theoreticalPrice"
                                            name="Precio Sugerido (IPC)"
                                            stroke="#f59e0b"
                                            strokeDasharray="5 5"
                                            strokeWidth={2}
                                            dot={false}
                                        />

                                        {/* Actual Price */}
                                        <Line
                                            type="monotone"
                                            dataKey="pricePerHour"
                                            name="Precio Pagado"
                                            stroke="#10b981"
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

            {/* History Table */}
            <Card className="bg-slate-950 border-slate-900 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-400">Historial</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3">Periodo</th>
                                    <th className="px-4 py-3 text-right">Precio Hora</th>
                                    <th className="px-4 py-3 text-right">Horas/Sem</th>
                                    <th className="px-4 py-3 text-right">Total/Semana</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rawData && rawData.map((row: any) => (
                                    <tr key={row.id} className="border-b border-slate-800 hover:bg-slate-900/30">
                                        <td className="px-4 py-3 font-medium text-white">
                                            {new Date(row.year, row.month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                                            ${row.pricePerHour.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {row.hoursPerWeek} hs
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            ${(row.pricePerHour * row.hoursPerWeek).toLocaleString()}
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
