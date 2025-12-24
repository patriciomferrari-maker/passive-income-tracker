'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LineChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PercentageGrowthData {
    date: string;
    uvaGrowth: number;
    tcBlueGrowth: number;
    tcOficialGrowth: number;
    ipcAccumulated: number;
}

type Period = 'YTD' | '3Y' | '5Y' | 'ALL' | 'CUSTOM';

/**
 * Chart: UVA Evolution vs Exchange Rates and Inflation
 * Shows percentage growth from baseline for UVA, TC Blue, TC Oficial, and accumulated IPC
 */
export default function UVAEvolutionChart() {
    // Raw data from APIs
    const [rawUVA, setRawUVA] = useState<{ date: string, value: number }[]>([]);
    const [rawIPC, setRawIPC] = useState<{ date: string, value: number }[]>([]);
    const [rawTCBlue, setRawTCBlue] = useState<{ date: string, value: number }[]>([]);
    const [rawTCOficial, setRawTCOficial] = useState<{ date: string, value: number }[]>([]);

    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('3Y');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        // Fetch all raw data in parallel
        Promise.all([
            // UVA data - returns array directly
            fetch('/api/economic-data/uva').then(res => res.json()),
            // IPC data - returns array directly
            fetch('/api/admin/inflation').then(res => res.json()),
            // TC Blue data - returns array directly
            fetch('/api/admin/economic').then(res => res.json()),
            // TC Oficial data - returns array directly
            fetch('/api/economic-data/tc-oficial').then(res => res.json())
        ])
            .then(([uvaData, ipcData, tcBlueData, tcOficialData]) => {
                // Process UVA (daily, need monthly - last value of each month)
                const uvaProcessed = (Array.isArray(uvaData) ? uvaData : []).map((item: any) => {
                    const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
                    return { date: dateStr, value: item.value };
                }).sort((a, b) => a.date.localeCompare(b.date));

                console.log('[UVA Chart] UVA processed count:', uvaProcessed.length);
                console.log('[UVA Chart] UVA first 3:', uvaProcessed.slice(0, 3));
                console.log('[UVA Chart] UVA last 3:', uvaProcessed.slice(-3));

                // Get monthly UVA (last value of each month)
                const uvaMonthly = uvaProcessed.reduce((acc: any[], item: any) => {
                    const monthKey = item.date.slice(0, 7);
                    const existing = acc.find(x => x.date.startsWith(monthKey));
                    if (!existing) {
                        acc.push({ date: `${monthKey}-15`, value: item.value });
                    } else {
                        existing.value = item.value; // Keep updating to get last value
                    }
                    return acc;
                }, []).sort((a, b) => a.date.localeCompare(b.date));

                console.log('[UVA Chart] UVA monthly count:', uvaMonthly.length);
                console.log('[UVA Chart] UVA monthly first 3:', uvaMonthly.slice(0, 3));
                console.log('[UVA Chart] UVA monthly last 3:', uvaMonthly.slice(-3));

                // Process IPC (monthly)
                const ipcProcessed = (Array.isArray(ipcData) ? ipcData : []).map((item: any) => ({
                    date: `${item.year}-${String(item.month).padStart(2, '0')}-15`,
                    value: item.value
                })).sort((a, b) => a.date.localeCompare(b.date));

                console.log('[UVA Chart] IPC processed count:', ipcProcessed.length);
                console.log('[UVA Chart] IPC first 5:', ipcProcessed.slice(0, 5));
                console.log('[UVA Chart] IPC last 5:', ipcProcessed.slice(-5));
                console.log('[UVA Chart] IPC 2025:', ipcProcessed.filter(d => d.date.startsWith('2025')));

                // Process TC Blue (daily, need monthly - last value of each month)
                const tcBlueProcessed = (Array.isArray(tcBlueData) ? tcBlueData : []).map((item: any) => {
                    const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
                    return { date: dateStr, value: item.sellRate || item.value };
                }).sort((a, b) => a.date.localeCompare(b.date));

                const tcBlueMonthly = tcBlueProcessed.reduce((acc: any[], item: any) => {
                    const monthKey = item.date.slice(0, 7);
                    const existing = acc.find(x => x.date.startsWith(monthKey));
                    if (!existing) {
                        acc.push({ date: `${monthKey}-15`, value: item.value });
                    } else {
                        existing.value = item.value;
                    }
                    return acc;
                }, []).sort((a, b) => a.date.localeCompare(b.date));

                // Process TC Oficial (daily, need monthly - last value of each month)
                const tcOficialProcessed = (Array.isArray(tcOficialData) ? tcOficialData : []).map((item: any) => {
                    const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
                    return { date: dateStr, value: item.sellRate || item.value };
                }).sort((a, b) => a.date.localeCompare(b.date));

                const tcOficialMonthly = tcOficialProcessed.reduce((acc: any[], item: any) => {
                    const monthKey = item.date.slice(0, 7);
                    const existing = acc.find(x => x.date.startsWith(monthKey));
                    if (!existing) {
                        acc.push({ date: `${monthKey}-15`, value: item.value });
                    } else {
                        existing.value = item.value;
                    }
                    return acc;
                }, []).sort((a, b) => a.date.localeCompare(b.date));

                // Store processed data in state
                setRawUVA(uvaMonthly);
                setRawIPC(ipcProcessed);
                setRawTCBlue(tcBlueMonthly);
                setRawTCOficial(tcOficialMonthly);

                console.log('[UVA Chart] All data processed and stored');
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching data:', err);
                setLoading(false);
            });
    }, []);

    // Filter and calculate percentage growth based on selected period
    const { filteredData, startDateLabel } = useMemo(() => {
        console.log('[useMemo] Executing with lengths:', 'UVA:', rawUVA.length, 'IPC:', rawIPC.length, 'TCBlue:', rawTCBlue.length, 'TCOficial:', rawTCOficial.length);
        console.log('[useMemo] selectedPeriod:', selectedPeriod);

        if (rawUVA.length === 0 || rawIPC.length === 0 || rawTCBlue.length === 0 || rawTCOficial.length === 0) {
            console.log('[useMemo] Returning empty - data not ready');
            return { filteredData: [], startDateLabel: '' };
        }

        // Work with year-month strings
        const firstMonth = rawUVA[0].date.slice(0, 7);
        const lastMonth = rawUVA[rawUVA.length - 1].date.slice(0, 7);

        let startMonth: string;
        const today = new Date();
        const currentYear = today.getFullYear();

        // Determine start month based on period
        if (selectedPeriod === 'CUSTOM' && customStartDate && customEndDate) {
            const customStart = new Date(`${customStartDate}-15`);
            const customEnd = new Date(`${customEndDate}-15`);
            return {
                filteredData: calculatePercentageGrowth(customStart, customEnd, false, rawUVA, rawIPC, rawTCBlue, rawTCOficial),
                startDateLabel: format(customStart, 'MMMM yyyy', { locale: es })
            };
        }

        switch (selectedPeriod) {
            case 'YTD':
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
                startMonth = firstMonth;
                break;
        }

        const startData = rawUVA.find(d => d.date.slice(0, 7) >= startMonth);
        if (!startData) return { filteredData: [], startDateLabel: '' };

        const startDate = new Date(startData.date);

        // Find the last month that has data in ALL arrays
        const lastUVAMonth = rawUVA[rawUVA.length - 1].date.slice(0, 7);
        const lastIPCMonth = rawIPC[rawIPC.length - 1].date.slice(0, 7);
        const lastTCBlueMonth = rawTCBlue[rawTCBlue.length - 1].date.slice(0, 7);
        const lastTCOficialMonth = rawTCOficial[rawTCOficial.length - 1].date.slice(0, 7);

        // Use the earliest of the last months (most restrictive)
        const endMonth = [lastUVAMonth, lastIPCMonth, lastTCBlueMonth, lastTCOficialMonth].sort()[0];

        // Construct end date directly from month string (use day 15 for consistency)
        const endDate = new Date(`${endMonth}-15T12:00:00`);

        console.log('[useMemo] Last months - UVA:', lastUVAMonth, 'IPC:', lastIPCMonth, 'TCBlue:', lastTCBlueMonth, 'TCOficial:', lastTCOficialMonth, '→ Using:', endMonth);

        const useAsBaseline = selectedPeriod === 'YTD';

        const calculatedData = calculatePercentageGrowth(startDate, endDate, useAsBaseline, rawUVA, rawIPC, rawTCBlue, rawTCOficial);
        console.log('[useMemo] calculatePercentageGrowth returned', calculatedData.length, 'points');

        return {
            filteredData: calculatedData,
            startDateLabel: format(startDate, 'MMMM yyyy', { locale: es })
        };
    }, [rawUVA, rawIPC, rawTCBlue, rawTCOficial, selectedPeriod, customStartDate, customEndDate]);

    function calculatePercentageGrowth(
        startDate: Date,
        endDate: Date,
        useAsBaseline: boolean,
        uvaData: { date: string, value: number }[],
        ipcData: { date: string, value: number }[],
        tcBlueData: { date: string, value: number }[],
        tcOficialData: { date: string, value: number }[]
    ): PercentageGrowthData[] {
        const startMonthKey = format(startDate, 'yyyy-MM');
        const endMonthKey = format(endDate, 'yyyy-MM');

        console.log('[calculatePercentageGrowth] startMonthKey:', startMonthKey, 'endMonthKey:', endMonthKey, 'useAsBaseline:', useAsBaseline);
        console.log('[calculatePercentageGrowth] Data lengths:', 'UVA:', uvaData.length, 'IPC:', ipcData.length, 'TCBlue:', tcBlueData.length, 'TCOficial:', tcOficialData.length);

        // Find baseline month indices
        const uvaStartIdx = uvaData.findIndex(d => d.date.startsWith(startMonthKey));
        const ipcStartIdx = ipcData.findIndex(d => d.date.startsWith(startMonthKey));
        const tcBlueStartIdx = tcBlueData.findIndex(d => d.date.startsWith(startMonthKey));
        const tcOficialStartIdx = tcOficialData.findIndex(d => d.date.startsWith(startMonthKey));

        if (uvaStartIdx === -1 || ipcStartIdx === -1 || tcBlueStartIdx === -1 || tcOficialStartIdx === -1) {
            return [];
        }

        // Determine baseline index (for YTD use start month, otherwise use previous month)
        let baselineUVAIdx = useAsBaseline ? uvaStartIdx : Math.max(0, uvaStartIdx - 1);
        let baselineIPCIdx = useAsBaseline ? ipcStartIdx : Math.max(0, ipcStartIdx - 1);
        let baselineTCBlueIdx = useAsBaseline ? tcBlueStartIdx : Math.max(0, tcBlueStartIdx - 1);
        let baselineTCOficialIdx = useAsBaseline ? tcOficialStartIdx : Math.max(0, tcOficialStartIdx - 1);

        // Get baseline values
        const baselineUVA = uvaData[baselineUVAIdx].value;
        const baselineTCBlue = tcBlueData[baselineTCBlueIdx].value;
        const baselineTCOficial = tcOficialData[baselineTCOficialIdx].value;

        const result: PercentageGrowthData[] = [];
        let accumulatedInflation = 1; // For IPC accumulated

        // Add baseline point (0% for all)
        result.push({
            date: uvaData[baselineUVAIdx].date,
            uvaGrowth: 0,
            tcBlueGrowth: 0,
            tcOficialGrowth: 0,
            ipcAccumulated: 0
        });

        // Calculate from baseline+1 to end (iterate by MONTHS, not indices)
        console.log('[calculatePercentageGrowth] Iterating from', startMonthKey, 'to', endMonthKey);

        // Generate ALL months in the range, not just months that exist in uvaData
        // Generate ALL months in the range using string manipulation (avoid timezone issues)
        const monthsToProcess: string[] = [];
        const [startYear, startMonth] = startMonthKey.split('-').map(Number);
        const [endYear, endMonth] = endMonthKey.split('-').map(Number);

        let currentYear = startYear;
        let currentMonth = startMonth;

        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            monthsToProcess.push(monthKey);

            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        console.log('[calculatePercentageGrowth] Months to process:', monthsToProcess.length, 'months');
        console.log('[calculatePercentageGrowth] First month:', monthsToProcess[0], 'Last month:', monthsToProcess[monthsToProcess.length - 1]);

        // Iterate over each month after baseline
        const baselineMonthKey = uvaData[baselineUVAIdx].date.slice(0, 7);
        for (const currentMonthKey of monthsToProcess) {
            // Skip baseline month (already added)
            if (currentMonthKey === baselineMonthKey) continue;

            // Find data for this month in each array
            const uvaIdx = uvaData.findIndex(d => d.date.startsWith(currentMonthKey));
            const ipcIdx = ipcData.findIndex(d => d.date.startsWith(currentMonthKey));
            const tcBlueIdx = tcBlueData.findIndex(d => d.date.startsWith(currentMonthKey));
            const tcOficialIdx = tcOficialData.findIndex(d => d.date.startsWith(currentMonthKey));

            if (uvaIdx === -1 || ipcIdx === -1 || tcBlueIdx === -1 || tcOficialIdx === -1) {
                console.log(`[calculatePercentageGrowth] SKIP month=${currentMonthKey}: uvaIdx=${uvaIdx}, ipcIdx=${ipcIdx}, tcBlueIdx=${tcBlueIdx}, tcOficialIdx=${tcOficialIdx}`);
                continue;
            }

            // Calculate UVA growth %
            const uvaGrowth = ((uvaData[uvaIdx].value - baselineUVA) / baselineUVA) * 100;

            // Calculate TC Blue devaluation %
            const tcBlueGrowth = ((tcBlueData[tcBlueIdx].value - baselineTCBlue) / baselineTCBlue) * 100;

            // Calculate TC Oficial growth %
            const tcOficialGrowth = ((tcOficialData[tcOficialIdx].value - baselineTCOficial) / baselineTCOficial) * 100;

            // Calculate IPC accumulated (compound from baseline)
            if (ipcIdx > baselineIPCIdx) {
                accumulatedInflation *= (1 + ipcData[ipcIdx].value / 100);
            }
            const ipcAccumulated = (accumulatedInflation - 1) * 100;

            result.push({
                date: uvaData[uvaIdx].date,
                uvaGrowth,
                tcBlueGrowth,
                tcOficialGrowth,
                ipcAccumulated
            });
            console.log(`[calculatePercentageGrowth] ✓ Added point for ${currentMonthKey}`);
        }

        return result;
    }

    if (loading) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">Cargando evolución UVA...</div>
                </CardContent>
            </Card>
        );
    }

    if (filteredData.length === 0) {
        return (
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="text-slate-400 text-center">No hay datos disponibles</div>
                </CardContent>
            </Card>
        );
    }

    const latest = filteredData[filteredData.length - 1];

    return (
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5" />
                    Evolución del Valor UVA
                </CardTitle>
                <CardDescription className="text-slate-300">
                    Variación % acumulada desde {startDateLabel}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Period Controls */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* Period Buttons */}
                    <div className="flex gap-2 flex-wrap">
                        {(['YTD', '3Y', '5Y', 'ALL'] as Period[]).map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedPeriod === period
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                            >
                                {period}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedPeriod('CUSTOM')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedPeriod === 'CUSTOM'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            Personalizado
                        </button>
                    </div>

                    {/* Custom Date Range */}
                    {selectedPeriod === 'CUSTOM' && (
                        <div className="flex gap-4 items-center bg-slate-900 p-4 rounded-lg">
                            <div className="flex items-center gap-2">
                                <label className="text-slate-300 text-sm">Desde:</label>
                                <input
                                    type="month"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="bg-slate-800 text-slate-200 px-3 py-2 rounded border border-slate-700 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-slate-300 text-sm">Hasta:</label>
                                <input
                                    type="month"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="bg-slate-800 text-slate-200 px-3 py-2 rounded border border-slate-700 text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                        <div className="text-xs text-emerald-300 mb-1">UVA</div>
                        <div className="text-2xl font-bold text-emerald-400">
                            {latest.uvaGrowth.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="text-xs text-blue-300 mb-1">TC Blue</div>
                        <div className="text-2xl font-bold text-blue-400">
                            {latest.tcBlueGrowth.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="text-xs text-green-300 mb-1">TC Oficial</div>
                        <div className="text-2xl font-bold text-green-400">
                            {latest.tcOficialGrowth.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="text-xs text-red-300 mb-1">IPC</div>
                        <div className="text-2xl font-bold text-red-400">
                            {latest.ipcAccumulated.toFixed(1)}%
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
                                style={{ fontSize: '11px' }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                                interval="preserveStartEnd"
                                minTickGap={40}
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
                                dataKey="uvaGrowth"
                                name="UVA"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="tcBlueGrowth"
                                name="TC Blue"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="tcOficialGrowth"
                                name="TC Oficial"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="5 5"
                            />
                            <Line
                                type="monotone"
                                dataKey="ipcAccumulated"
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
                    Inflación: variación % IPC acumulada | Devaluación: variación % TC Blue acumulada | Valores normalizados a 0% en la fecha de inicio
                </div>
            </CardContent>
        </Card>
    );
}
