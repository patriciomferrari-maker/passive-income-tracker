'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function CashflowTab() {
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);

    // View State
    const [viewMode, setViewMode] = useState<'12MONTHS' | 'YEAR'>('12MONTHS');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const [rates, setRates] = useState<Record<string, number>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [trxRes, catRes, ratesRes] = await Promise.all([
                fetch('/api/costa/transactions'),
                fetch('/api/costa/categories'),
                fetch('/api/economic-data/tc')
            ]);
            const trxData = await trxRes.json();
            const catData = await catRes.json();
            const ratesData = await ratesRes.json();

            // Transform rates to Map: 'yyyy-MM' -> avg value
            const rateMap: Record<string, number> = {};
            if (Array.isArray(ratesData)) {
                ratesData.forEach((r: any) => {
                    const key = format(new Date(r.date), 'yyyy-MM');
                    // If multiple, maybe avg? Or take last. Using last for now as "closing" roughly.
                    // Ideally sorting descending by date first
                    if (!rateMap[key]) rateMap[key] = r.value;
                });
            }
            // Add Fallback default 1200
            rateMap['default'] = 1200;

            setTransactions(trxData);
            setCategories(catData);
            setRates(rateMap);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Data Processing ---
    // 1. Determine Date Range Columns
    let columns: Date[] = [];

    if (viewMode === 'YEAR') {
        // Jan to Dec of selected year
        columns = Array.from({ length: 12 }, (_, i) => new Date(selectedYear, i, 1));
    } else {
        // Last 12 Months
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        columns = Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1));
    }

    // 2. Build Rows
    const incomeRow = new Array(columns.length).fill(0);
    const totalExpensesRow = new Array(columns.length).fill(0);
    const netRow = new Array(columns.length).fill(0);
    const expenseRows = new Map<string, number[]>();

    categories.filter(c => c.type === 'EXPENSE').forEach(c => {
        expenseRows.set(c.name, new Array(columns.length).fill(0));
    });

    const getColumnIndex = (date: Date | string) => {
        // Handle timezone shift: Treat the date string as local or use UTC strictly
        const d = new Date(date);
        // Adjust for timezone offset to keep the same day as server (UTC)
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(d.getTime() + userTimezoneOffset);

        const monthYear = format(adjustedDate, 'yyyy-MM');
        return columns.findIndex(col => format(col, 'yyyy-MM') === monthYear);
    };

    transactions.forEach(t => {
        const colIndex = getColumnIndex(t.date);
        if (colIndex === -1) return;

        const dateKey = format(new Date(t.date), 'yyyy-MM');
        const rate = rates[dateKey] || 1200;

        let finalAmount = t.amount;
        if (t.currency === 'ARS') finalAmount = t.amount / rate;

        if (t.type === 'INCOME') {
            incomeRow[colIndex] += finalAmount;
            netRow[colIndex] += finalAmount;
        } else {
            const catName = t.category?.name || 'Varios';
            if (!expenseRows.has(catName)) expenseRows.set(catName, new Array(columns.length).fill(0));
            expenseRows.get(catName)![colIndex] += finalAmount;
            totalExpensesRow[colIndex] += finalAmount;
            netRow[colIndex] -= finalAmount;
        }
    });

    // --- Filter Empty Columns (Refinement) ---
    const activeIndices = columns.map((_, i) => {
        const hasIncome = incomeRow[i] !== 0;
        const hasExpense = totalExpensesRow[i] !== 0;
        return hasIncome || hasExpense;
    });

    const filterByActivity = (arr: any[]) => arr.filter((_, i) => activeIndices[i]);

    const activeColumns = filterByActivity(columns);
    const activeIncomeRow = filterByActivity(incomeRow);
    const activeTotalExpensesRow = filterByActivity(totalExpensesRow);
    const activeNetRow = filterByActivity(netRow);

    const activeExpenseRows = new Map<string, number[]>();
    expenseRows.forEach((vals, key) => {
        activeExpenseRows.set(key, filterByActivity(vals));
    });

    const formatMoney = (val: number) => {
        if (Math.abs(val) < 1) return '-';
        return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    };

    if (loading) return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Cargando movimientos...</div>;

    const availableYears = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort((a, b) => b - a);
    if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear());

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-xl font-bold text-white">Flujo de Caja</h2>

                <div className="flex items-center gap-2">
                    <Select value={viewMode === '12MONTHS' ? '12MONTHS' : selectedYear.toString()} onValueChange={(val: string) => {
                        if (val === '12MONTHS') {
                            setViewMode('12MONTHS');
                        } else {
                            setViewMode('YEAR');
                            setSelectedYear(parseInt(val));
                        }
                    }}>
                        <SelectTrigger className="bg-slate-900 border-slate-700 text-white w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border-slate-700 text-white">
                            <SelectItem value="12MONTHS">Últimos 12 Meses</SelectItem>
                            {availableYears.map(y => (
                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* USD Note */}
            <div className="text-right text-xs text-slate-500 italic">
                * Valores expresados en USD. Gastos en ARS convertidos al tipo de cambio (Blue) del mes correspondiente.
            </div>

            <Card className="bg-slate-900 border-slate-800 overflow-x-auto">
                <CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-slate-950 text-slate-400">
                            <tr>
                                <th className="px-4 py-3 sticky left-0 bg-slate-950 z-10 w-48 border-b border-slate-800">Concepto</th>
                                {activeColumns.map((col, i) => (
                                    <th key={i} className="px-4 py-3 text-right min-w-[100px] border-b border-slate-800">
                                        {format(col, 'MMM yy', { locale: es })}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right bg-slate-950 font-bold min-w-[120px] border-b border-slate-800">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">

                            {/* INGRESOS SECTION */}
                            <tr className="bg-emerald-950/20">
                                <td colSpan={columns.length + 2} className="px-4 py-2 font-bold text-emerald-500 text-xs tracking-wider">INGRESOS</td>
                            </tr>
                            <tr className="hover:bg-slate-800/50">
                                <td className="px-4 py-2 sticky left-0 bg-slate-900 z-10">Alquileres</td>
                                {activeIncomeRow.map((val: number, i: number) => (
                                    <td key={i} className="px-4 py-2 text-right text-slate-300">{formatMoney(val)}</td>
                                ))}
                                <td className="px-4 py-2 text-right font-medium text-emerald-400">
                                    {formatMoney(activeIncomeRow.reduce((a: number, b: number) => a + b, 0))}
                                </td>
                            </tr>
                            {/* Total Ingresos (Optional if only one row, but good for structure) */}
                            <tr className="bg-slate-900/50 font-medium">
                                <td className="px-4 py-2 sticky left-0 bg-slate-900 z-10 text-emerald-400 pl-8">Total Ingresos</td>
                                {activeIncomeRow.map((val: number, i: number) => (
                                    <td key={i} className="px-4 py-2 text-right text-emerald-400">{formatMoney(val)}</td>
                                ))}
                                <td className="px-4 py-2 text-right text-emerald-400 font-bold">
                                    {formatMoney(activeIncomeRow.reduce((a: number, b: number) => a + b, 0))}
                                </td>
                            </tr>

                            {/* GASTOS SECTION */}
                            <tr className="bg-red-950/20 border-t border-slate-800">
                                <td colSpan={columns.length + 2} className="px-4 py-2 font-bold text-red-500 text-xs tracking-wider">GASTOS</td>
                            </tr>
                            {Array.from(activeExpenseRows.entries()).sort().map(([cat, vals]) => {
                                const total = vals.reduce((a, b) => a + b, 0);
                                if (total === 0 && viewMode === '12MONTHS' && vals.every(v => v === 0)) return null;
                                return (
                                    <tr key={cat} className="hover:bg-slate-800/50">
                                        <td className="px-4 py-2 sticky left-0 bg-slate-900 z-10 pl-8">{cat}</td>
                                        {vals.map((val, i) => (
                                            <td key={i} className="px-4 py-2 text-right text-slate-400">{formatMoney(val)}</td>
                                        ))}
                                        <td className="px-4 py-2 text-right font-medium">
                                            {formatMoney(total)}
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-slate-900/50 font-medium border-t border-slate-800">
                                <td className="px-4 py-2 sticky left-0 bg-slate-900 z-10 text-red-400 pl-8">Total Gastos</td>
                                {activeTotalExpensesRow.map((val: number, i: number) => (
                                    <td key={i} className="px-4 py-2 text-right text-red-400">{formatMoney(val)}</td>
                                ))}
                                <td className="px-4 py-2 text-right text-red-400 font-bold">
                                    {formatMoney(activeTotalExpensesRow.reduce((a: number, b: number) => a + b, 0))}
                                </td>
                            </tr>

                            {/* RESULTADOS SECTION */}
                            <tr className="bg-slate-950/50 border-t-2 border-slate-800">
                                <td colSpan={columns.length + 2} className="h-4" />
                            </tr>

                            {/* Net Result */}
                            <tr className="bg-slate-950 font-bold text-white text-base">
                                <td className="px-4 py-3 sticky left-0 bg-slate-950 z-10">Resultado Neto</td>
                                {activeNetRow.map((val: number, i: number) => (
                                    <td key={i} className={`px-4 py-3 text-right ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatMoney(val)}
                                    </td>
                                ))}
                                <td className={`px-4 py-3 text-right ${activeNetRow.reduce((a: number, b: number) => a + b, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatMoney(activeNetRow.reduce((a: number, b: number) => a + b, 0))}
                                </td>
                            </tr>

                            {/* Accumulated Net Result */}
                            <tr className="bg-slate-950 font-bold text-white text-base border-t border-slate-800">
                                <td className="px-4 py-3 sticky left-0 bg-slate-950 z-10">Resultado Acumulado</td>
                                {activeNetRow.reduce((acc: number[], curr: number, i: number) => {
                                    const prev = i > 0 ? acc[i - 1] : 0;
                                    acc.push(prev + curr);
                                    return acc;
                                }, []).map((val: number, i: number) => (
                                    <td key={i} className={`px-4 py-3 text-right ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatMoney(val)}
                                    </td>
                                ))}
                                <td className="px-4 py-3 text-right text-slate-500">
                                    {formatMoney(activeNetRow.reduce((a: number, b: number) => a + b, 0))}
                                </td>
                            </tr>

                            {/* Exchange Rate Row */}
                            <tr className="bg-slate-900/30 text-xs text-slate-500 uppercase tracking-wider">
                                <td className="px-4 py-3 sticky left-0 bg-slate-900/30 z-10">TC Tomado (USD Blue)</td>
                                {activeColumns.map((col, i) => {
                                    const key = format(col, 'yyyy-MM');
                                    const rate = rates[key];
                                    return (
                                        <td key={i} className="px-4 py-3 text-right">
                                            {rate ? `$${rate}` : '-'}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-right">Promedio</td>
                            </tr>

                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
