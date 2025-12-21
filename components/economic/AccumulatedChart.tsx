'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { format, subYears, parse, isAfter, isBefore, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface AccumulatedData {
    date: string;
    inflacionAcumulada: number;
    devaluacionAcumulada: number;
}

type Period = '1Y' | '3Y' | '5Y' | 'ALL' | 'CUSTOM';

/**
 * Chart 1: Inflación y Devaluación Acumulada (extended scope)
 * Shows accumulated inflation vs devaluation with period controls and custom date range
 */
export default function AccumulatedChart() {
    const [rawData, setRawData] = useState<AccumulatedData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('3Y');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        fetch('/api/economic-data/accumulated')
            .then(res => res.json())
            .then(result => {
                setRawData(result.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching accumulated data:', err);
                setLoading(false);
            });
    }, []);

    // Filter and recalculate accumulated values based on selected period
    const { filteredData, startDateLabel } = useMemo(() => {
        if (rawData.length === 0) return { filteredData: [], startDateLabel: '' };

        let cutoffDate: Date;
        const today = new Date();
        const firstDate = new Date(rawData[0].date);
        const lastDate = new Date(rawData[rawData.length - 1].date);

        // Determine the date range based on selected period
        if (selectedPeriod === 'CUSTOM' && customStartDate && customEndDate) {
            const customStart = parse(customStartDate, 'yyyy-MM', new Date());
            const customEnd = parse(customEndDate, 'yyyy-MM', new Date());

            // Filter data within custom range
            const filtered = rawData.filter(d => {
                const date = new Date(d.date);
                return date >= customStart && date <= customEnd;
            });

            if (filtered.length === 0) return { filteredData: [], startDateLabel: '' };

            // Recalculate accumulated from the start of custom range
            return {
                filteredData: recalculateAccumulated(rawData, customStart, customEnd),
                startDateLabel: format(customStart, 'MMMM yyyy', { locale: es })
            };
        }

        // Preset periods
        switch (selectedPeriod) {
            case '1Y':
                cutoffDate = subYears(today, 1);
                break;
            case '3Y':
                cutoffDate = subYears(today, 3);
                break;
            case '5Y':
                cutoffDate = subYears(today, 5);
                break;
            case 'ALL':
            default:
                cutoffDate = firstDate;
                break;
        }

        // Find the closest available date to cutoff
        const startDate = rawData.find(d => new Date(d.date) >= cutoffDate)?.date || rawData[0].date;
        const actualStartDate = new Date(startDate);

        return {
            filteredData: recalculateAccumulated(rawData, actualStartDate, lastDate),
            startDateLabel: format(actualStartDate, 'MMMM yyyy', { locale: es })
        };
    }, [rawData, selectedPeriod, customStartDate, customEndDate]);

    // Recalculate accumulated values starting from 0 at the given start date
    function recalculateAccumulated(data: AccumulatedData[], startDate: Date, endDate: Date): AccumulatedData[] {
        // Filter to date range
        const rangeData = data.filter(d => {
            const date = new Date(d.date);
            return date >= startDate && date <= endDate;
        });

        if (rangeData.length === 0) return [];

        // Get the base values at the start date - these will be subtracted to normalize to 0
        const baseInflacion = rangeData[0].inflacionAcumulada;
        const baseDevaluacion = rangeData[0].devaluacionAcumulada;

        // CRITICAL: Recalculate accumulated values relative to the start date
        // The first point MUST be exactly 0%, subsequent points show change from that baseline
        return rangeData.map((d, index) => ({
            date: d.date,
            // For the first point, force to exactly 0 to avoid floating point errors
            inflacionAcumulada: index === 0 ? 0 : d.inflacionAcumulada - baseInflacion,
            devaluacionAcumulada: index === 0 ? 0 : d.devaluacionAcumulada - baseDevaluacion
        }));
    }

    // Calculate dynamic Y-axis domain
    const yAxisDomain = useMemo(() => {
        if (filteredData.length === 0) return [0, 100];

        const values = filteredData.flatMap(d => [
            d.inflacionAcumulada,
            d.devaluacionAcumulada
        ]);

        const maxValue = Math.max(...values);
        const minValue = Math.min(...values);

        // Add 10% padding
        const range = maxValue - minValue;
        const padding = range * 0.1;
        const upperBound = Math.ceil(maxValue + padding);
        const lowerBound = Math.floor(minValue - padding);

        return [lowerBound, upperBound];
    }, [filteredData]);

    if (loading) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">Cargando datos acumulados...</div>
                </CardContent>
            </Card>
        );
    }

    if (rawData.length === 0) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">No hay datos disponibles</div>
                </CardContent>
            </Card>
        );
    }

    const latest = filteredData.length > 0 ? filteredData[filteredData.length - 1] : { inflacionAcumulada: 0, devaluacionAcumulada: 0 };
    const diff = latest.devaluacionAcumulada - latest.inflacionAcumulada;

    // Get available date range for custom selector
    const minDate = rawData[0]?.date ? format(new Date(rawData[0].date), 'yyyy-MM') : '';
    const maxDate = rawData[rawData.length - 1]?.date ? format(new Date(rawData[rawData.length - 1].date), 'yyyy-MM') : '';

    return (
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-white flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Inflación vs Devaluación Acumulada
                        </CardTitle>
                        <CardDescription className="text-slate-300">
                            Variación % acumulada desde {startDateLabel || 'el primer registro'}
                        </CardDescription>
                    </div>

                    {/* Period Selector */}
                    <div className="flex gap-2">
                        {(['1Y', '3Y', '5Y', 'ALL'] as Period[]).map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${selectedPeriod === period
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                    }`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Date Range Selector */}
                <div className="mt-4 flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-400 whitespace-nowrap">Desde:</label>
                        <input
                            type="month"
                            value={customStartDate}
                            onChange={(e) => {
                                setCustomStartDate(e.target.value);
                                if (e.target.value && customEndDate) {
                                    setSelectedPeriod('CUSTOM');
                                }
                            }}
                            min={minDate}
                            max={maxDate}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-400 whitespace-nowrap">Hasta:</label>
                        <input
                            type="month"
                            value={customEndDate}
                            onChange={(e) => {
                                setCustomEndDate(e.target.value);
                                if (customStartDate && e.target.value) {
                                    setSelectedPeriod('CUSTOM');
                                }
                            }}
                            min={customStartDate || minDate}
                            max={maxDate}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]"
                        />
                    </div>
                    {selectedPeriod === 'CUSTOM' && (
                        <button
                            onClick={() => {
                                setSelectedPeriod('3Y');
                                setCustomStartDate('');
                                setCustomEndDate('');
                            }}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
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
                    <div className={`${diff > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'} border rounded-lg p-4`}>
                        <div className={`text-xs ${diff > 0 ? 'text-orange-300' : 'text-green-300'} mb-1`}>
                            Diferencia
                        </div>
                        <div className={`text-2xl font-bold ${diff > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                            {Math.abs(diff).toFixed(1)}pp
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
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
                                domain={yAxisDomain}
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
                            {/* Reference line at Y=0 */}
                            <ReferenceLine
                                y={0}
                                stroke="#64748b"
                                strokeDasharray="5 5"
                                strokeWidth={1}
                            />
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
                    Inflación: variación % IPC acumulada | Devaluación: variación % TC Blue acumulada | Valores normalizados a 0% en la fecha de inicio
                </div>
            </CardContent>
        </Card>
    );
}
