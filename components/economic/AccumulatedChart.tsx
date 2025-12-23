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

type Period = 'YTD' | '3Y' | '5Y' | 'ALL' | 'CUSTOM';

/**
 * Chart 1: Inflación y Devaluación Acumulada (extended scope)
 * Shows accumulated inflation vs devaluation with period controls and custom date range
 */
export default function AccumulatedChart() {
    const [rawData, setRawData] = useState<AccumulatedData[]>([]);
    const [rawIPC, setRawIPC] = useState<{ date: string; value: number }[]>([]); // Monthly IPC %
    const [rawTC, setRawTC] = useState<{ date: string; value: number }[]>([]); // Daily TC Blue
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('3Y');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        // Fetch both accumulated data (for reference) and raw IPC/TC data for client-side calculation
        Promise.all([
            fetch('/api/economic-data/accumulated').then(res => res.json()),
            // Fetch raw IPC data from EconomicIndicator
            fetch('/api/admin/inflation').then(res => res.json()),
            // Fetch raw TC Blue data  
            fetch('/api/admin/economic').then(res => res.json())
        ])
            .then(([accResult, ipcData, tcData]) => {
                setRawData(accResult.data || []);

                // Process IPC data (it's monthly) - API returns DESC, need ASC
                const ipcProcessed = (ipcData || []).map((item: any) => ({
                    date: `${item.year}-${String(item.month).padStart(2, '0')}-01`,
                    value: item.value
                })).sort((a, b) => a.date.localeCompare(b.date)); // SORT ASCENDING BY DATE
                setRawIPC(ipcProcessed);

                // Process TC data (it's daily, need to average by month)
                const tcByMonth = new Map<string, { sum: number; count: number }>();
                (tcData || []).forEach((item: any) => {
                    const monthKey = new Date(item.date).toISOString().slice(0, 7);
                    const existing = tcByMonth.get(monthKey) || { sum: 0, count: 0 };
                    tcByMonth.set(monthKey, {
                        sum: existing.sum + item.value,
                        count: existing.count + 1
                    });
                });

                const tcProcessed = Array.from(tcByMonth.entries()).map(([monthKey, data]) => ({
                    date: `${monthKey}-01`,
                    value: data.sum / data.count
                })).sort((a, b) => a.date.localeCompare(b.date));

                setRawTC(tcProcessed);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching data:', err);
                setLoading(false);
            });
    }, []);

    // Filter and recalculate accumulated values based on selected period
    const { filteredData, startDateLabel } = useMemo(() => {
        if (rawIPC.length === 0 || rawTC.length === 0) return { filteredData: [], startDateLabel: '' };

        // Work with year-month strings instead of Date objects
        const firstIPCMonth = rawIPC[0].date.slice(0, 7); // "YYYY-MM"
        const lastIPCMonth = rawIPC[rawIPC.length - 1].date.slice(0, 7); // "YYYY-MM"

        let startMonth: string;
        const today = new Date();
        const currentYear = today.getFullYear();

        // Determine the date range based on selected period (using year-month strings)
        if (selectedPeriod === 'CUSTOM' && customStartDate && customEndDate) {
            const customStart = new Date(customStartDate);
            const customEnd = new Date(customEndDate);
            return {
                filteredData: calculateAccumulatedFromPeriod(customStart, customEnd),
                startDateLabel: format(customStart, 'MMMM yyyy', { locale: es })
            };
        }

        // Preset periods - calculate start month
        switch (selectedPeriod) {
            case 'YTD':
                // Year to date: from DECEMBER of previous year (as baseline 0%)
                // So for 2025, we start at Dec 2024
                startMonth = `${currentYear - 1}-12`;
                break;
            case '3Y':
                startMonth = `${currentYear - 3}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                break;
            case '5Y':
                startMonth = `${currentYear - 5}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                break;
            case 'ALL':
            default:
                startMonth = firstIPCMonth;
                break;
        }

        // Find the first available month >= startMonth
        const startData = rawIPC.find(d => d.date.slice(0, 7) >= startMonth);
        if (!startData) return { filteredData: [], startDateLabel: '' };

        const startDate = new Date(startData.date);
        const endDate = new Date(rawIPC[rawIPC.length - 1].date); // Use last available month

        // For YTD: use December AS the baseline (not previous month)
        const useAsBaseline = selectedPeriod === 'YTD';

        return {
            filteredData: calculateAccumulatedFromPeriod(startDate, endDate, useAsBaseline),
            startDateLabel: format(startDate, 'MMMM yyyy', { locale: es })
        };
    }, [rawIPC, rawTC, selectedPeriod, customStartDate, customEndDate]);

    // Calculate accumulated inflation/devaluation starting from a specific period
    // For YTD: startDate IS the baseline month (December)
    // For other periods: uses previous month as baseline
    function calculateAccumulatedFromPeriod(startDate: Date, endDate: Date, useAsBaseline = false): AccumulatedData[] {
        // Convert dates to month keys for easier comparison
        const startMonthKey = format(startDate, 'yyyy-MM');
        const endMonthKey = format(endDate, 'yyyy-MM');

        // Find index of start month in IPC data
        const startIndex = rawIPC.findIndex(d => d.date.startsWith(startMonthKey));
        if (startIndex === -1) return [];

        // Baseline logic:
        // - If useAsBaseline=true: use startDate month AS the baseline
        // - Otherwise: use PREVIOUS month as baseline
        let baselineIndex: number;
        if (useAsBaseline) {
            // Use the start month itself as baseline (for YTD)
            baselineIndex = startIndex;
        } else {
            // Use previous month as baseline (for other periods)
            baselineIndex = Math.max(0, startIndex - 1);
        }

        let baselineDate = rawIPC[baselineIndex].date;
        let baselineMonthKey = baselineDate.slice(0, 7);

        // CRITICAL FIX: Find first month where BOTH IPC and TC exist
        // This handles cases where TC data doesn't exist for early months
        let baselineTC = rawTC.find(d => d.date.startsWith(baselineMonthKey));

        // If baseline month doesn't have TC, find the FIRST month that has both
        if (!baselineTC) {
            // For "ALL" view starting very early, find first valid month
            for (let i = 0; i < rawIPC.length; i++) {
                const monthKey = rawIPC[i].date.slice(0, 7);
                const tc = rawTC.find(d => d.date.startsWith(monthKey));
                if (tc) {
                    baselineIndex = i;
                    baselineDate = rawIPC[i].date;
                    baselineMonthKey = monthKey;
                    baselineTC = tc;
                    break;
                }
            }
        }

        if (!baselineTC) {
            console.error('No TC data found for any month in range');
            return [];
        }

        const baseTCValue = baselineTC.value;

        // Build accumulated data starting from baseline
        const result: AccumulatedData[] = [];
        let accumulatedInflation = 1; // Start at 1 (100%)

        // First point: baseline month with 0%
        result.push({
            date: baselineDate,
            inflacionAcumulada: 0,
            devaluacionAcumulada: 0
        });

        // Iterate from baseline+1 to end, compounding inflation
        for (let i = baselineIndex + 1; i < rawIPC.length; i++) {
            const currentMonth = rawIPC[i];
            const currentMonthKey = currentMonth.date.slice(0, 7);

            // Stop if we've passed the end date
            if (currentMonthKey > endMonthKey) break;

            // Get CURRENT month's IPC for compounding
            const currentIPC = rawIPC[i].value;

            // Compound: multiply by (1 + current_month_ipc%)
            accumulatedInflation *= (1 + currentIPC / 100);

            // Get TC for this month
            const currentTC = rawTC.find(d => d.date.startsWith(currentMonthKey));

            // If no TC data for this month, skip adding the point but continue compounding
            // This allows inflation to accumulate even if TC data is sparse
            if (!currentTC) {
                console.warn(`Missing TC data for ${currentMonthKey}, skipping point but continuing accumulation`);
                continue;
            }

            // Devaluation: percentage change from baseline
            const devaluacion = ((currentTC.value - baseTCValue) / baseTCValue) * 100;

            result.push({
                date: currentMonth.date,
                inflacionAcumulada: (accumulatedInflation - 1) * 100,
                devaluacionAcumulada: devaluacion
            });
        }

        return result;
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
    const minDate = rawIPC[0]?.date ? format(new Date(rawIPC[0].date), 'yyyy-MM') : '';
    const maxDate = rawIPC[rawIPC.length - 1]?.date ? format(new Date(rawIPC[rawIPC.length - 1].date), 'yyyy-MM') : '';

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
                        {(['YTD', '3Y', '5Y', 'ALL'] as Period[]).map((period) => (
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
