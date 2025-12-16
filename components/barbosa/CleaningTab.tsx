'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Save, TrendingUp } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

export function CleaningTab() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        hoursPerWeek: 12,
        weeklyValue: 0,
        monthlyIncrease: 0,
        legalHourlyRate: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/barbosa/cleaning');
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            await fetch('/api/barbosa/cleaning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            setIsOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving', error);
        }
    };

    // Auto-calculate logic when opening modal or changing increase
    useEffect(() => {
        if (isOpen && data.length > 0) {
            // Find most recent record to base calc
            // Data is ordered desc by default from API? Yes.
            const last = data[0];
            if (last) {
                // Predict next month
                let nextMonth = last.month + 1;
                let nextYear = last.year;
                if (nextMonth > 12) { nextMonth = 1; nextYear++; }

                // If form is untouched (default 0), prefill
                if (formData.weeklyValue === 0) {
                    const base = last.weeklyValue;
                    const newVal = base * (1 + (formData.monthlyIncrease / 100));
                    setFormData(prev => ({
                        ...prev,
                        month: nextMonth,
                        year: nextYear,
                        hoursPerWeek: last.hoursPerWeek,
                        weeklyValue: Math.round(newVal),
                        legalHourlyRate: last.legalHourlyRate // Copy prev legal as baseline
                    }));
                }
            }
        }
    }, [isOpen, formData.monthlyIncrease]);

    // Derived Metrics for Chart
    const chartData = [...data].reverse().map(d => ({
        label: `${d.month}/${d.year}`,
        gapPercent: d.legalHourlyRate ? ((d.pricePerHour - d.legalHourlyRate) / d.legalHourlyRate) * 100 : 0,
        myRate: d.pricePerHour,
        legalRate: d.legalHourlyRate || 0
    }));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Registro de Limpieza</h2>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus size={16} className="mr-2" />
                            Nuevo Mes
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                        <DialogHeader>
                            <DialogTitle>Cargar Mes de Limpieza</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Mes</Label>
                                    <Input
                                        type="number"
                                        value={formData.month}
                                        onChange={e => setFormData({ ...formData, month: parseInt(e.target.value) })}
                                        className="bg-slate-950 border-slate-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Año</Label>
                                    <Input
                                        type="number"
                                        value={formData.year}
                                        onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                        className="bg-slate-950 border-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Horas Semanales</Label>
                                <Input
                                    type="number"
                                    value={formData.hoursPerWeek}
                                    onChange={e => setFormData({ ...formData, hoursPerWeek: parseInt(e.target.value) })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Aumento Mensual (%)</Label>
                                    <Input
                                        type="number"
                                        value={formData.monthlyIncrease}
                                        onChange={e => {
                                            const inc = parseFloat(e.target.value);
                                            // Recalc weekly value based on PREV record if exists
                                            // Ideally we'd store prevRecord in state, but simpler hack:
                                            // If we assume user fills this first, they manually adjust Weekly Value later.
                                            setFormData({ ...formData, monthlyIncrease: inc })
                                        }}
                                        className="bg-slate-950 border-slate-800"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor Semana (Pagado)</Label>
                                    <Input
                                        type="number"
                                        value={formData.weeklyValue}
                                        onChange={e => setFormData({ ...formData, weeklyValue: parseFloat(e.target.value) })}
                                        className="bg-slate-950 border-slate-800 font-bold text-emerald-400"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Valor Hora (Según Ley/Referencias)</Label>
                                <Input
                                    type="number"
                                    value={formData.legalHourlyRate}
                                    onChange={e => setFormData({ ...formData, legalHourlyRate: parseFloat(e.target.value) })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>

                            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 mt-4">
                                <Save className="mr-2 h-4 w-4" /> Guardar Registro
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-slate-950 border-slate-800 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-white text-sm">Diferencia vs Ley (%)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorGap" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                                    <YAxis stroke="#64748b" fontSize={12} unit="%" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="gapPercent" stroke="#10b981" fillOpacity={1} fill="url(#colorGap)" name="Diferencia %" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI Card */}
                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <div className="mb-4">
                            <p className="text-slate-400 text-sm upp">Último Valor Hora (Mío)</p>
                            <p className="text-3xl font-bold text-white font-mono">
                                {data[0]?.pricePerHour ? `$${Math.round(data[0].pricePerHour)}` : '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm upp">Último Valor Hora (Ley)</p>
                            <p className="text-xl font-bold text-slate-400 font-mono">
                                {data[0]?.legalHourlyRate ? `$${Math.round(data[0].legalHourlyRate)}` : '-'}
                            </p>
                        </div>
                        {data[0]?.legalHourlyRate && (
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                <span className={`text-lg font-bold ${data[0].pricePerHour > data[0].legalHourlyRate ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {data[0].pricePerHour > data[0].legalHourlyRate ? '+' : ''}
                                    {Math.round(((data[0].pricePerHour - data[0].legalHourlyRate) / data[0].legalHourlyRate) * 100)}%
                                </span>
                                <span className="text-slate-500 text-xs ml-2">vs Ley</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-6 py-4">Mes</th>
                            <th className="px-6 py-4 text-right">Valor Semana</th>
                            <th className="px-6 py-4 text-center">Hs/Sem</th>
                            <th className="px-6 py-4 text-right text-emerald-400">$/Hora (Mío)</th>
                            <th className="px-6 py-4 text-right">$/Hora (Ley)</th>
                            <th className="px-6 py-4 text-right">Diferencia</th>
                            <th className="px-6 py-4 text-center">Aumento %</th>
                            <th className="px-6 py-4 text-right">Total Pagado (Aprox)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                    No hay registros cargados.
                                </td>
                            </tr>
                        ) : (
                            data.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-900/50">
                                    <td className="px-6 py-4 font-medium text-white">
                                        {row.month}/{row.year}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono">
                                        ${row.weeklyValue.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.hoursPerWeek}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-emerald-400 font-bold">
                                        ${Math.round(row.pricePerHour).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-400">
                                        {row.legalHourlyRate ? `$${row.legalHourlyRate.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono">
                                        {row.legalHourlyRate ? (
                                            <span className={row.pricePerHour > row.legalHourlyRate ? 'text-emerald-500' : 'text-red-500'}>
                                                {row.pricePerHour > row.legalHourlyRate ? '+' : ''}
                                                ${Math.round(row.pricePerHour - row.legalHourlyRate).toLocaleString()}
                                                <span className="text-xs opacity-70 ml-1">
                                                    ({Math.round(((row.pricePerHour - row.legalHourlyRate) / row.legalHourlyRate) * 100)}%)
                                                </span>
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {row.monthlyIncrease > 0 ? (
                                            <span className="text-amber-500 font-bold">
                                                +{row.monthlyIncrease}%
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                                        ${(row.weeklyValue * 4).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
