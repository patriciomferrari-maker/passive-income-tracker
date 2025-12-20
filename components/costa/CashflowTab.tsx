
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
    const [viewCurrency, setViewCurrency] = useState<'USD' | 'ARS'>('USD');

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
                    // Use UTC substring to ensure monthly alignment without timezone shifts
                    const key = r.date.substring(0, 7); // "2025-12"
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

    const getColumnIndex = (dateString: string) => {
        // Simple string comparison YYYY-MM
        const monthKey = dateString.substring(0, 7);
        return columns.findIndex(col => format(col, 'yyyy-MM') === monthKey);
    };

    transactions.forEach(t => {
        const colIndex = getColumnIndex(t.date);
        if (colIndex === -1) return;

        const dateKey = t.date.substring(0, 7);
        const rate = rates[dateKey] || 1200;

        // Conversion Logic based on viewCurrency
        let finalAmount = t.amount;
        if (viewCurrency === 'USD') {
            if (t.currency === 'ARS') finalAmount = t.amount / rate;
        } else {
            // View ARS
            if (t.currency === 'USD') finalAmount = t.amount * rate;
        }

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

    // --- Filter Empty Columns ---
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
        return val.toLocaleString('en-US', {
            style: 'currency',
            currency: viewCurrency,
            maximumFractionDigits: 0
        });
    };

    if (loading) return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Cargando movimientos...</div>;

    const availableYears = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort((a, b) => b - a);
    if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear());

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-xl font-bold text-white">Flujo de Caja</h2>

                <div className="flex gap-2">
                    {/* Currency Toggle */}
                    <Select value={viewCurrency} onValueChange={(v: 'USD' | 'ARS') => setViewCurrency(v)}>
                        <SelectTrigger className="w-[100px] bg-slate-900 border-slate-700 text-white">
                            <SelectValue placeholder="Moneda" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                            <SelectItem value="USD" className="text-white hover:bg-slate-800">USD</SelectItem>
                            <SelectItem value="ARS" className="text-white hover:bg-slate-800">ARS</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* View Mode Toggle */}
                    <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                        <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700 text-white">
                            <SelectValue placeholder="Vista" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700">
                            <SelectItem value="12MONTHS" className="text-white hover:bg-slate-800">Últimos 12 Meses</SelectItem>
                            <SelectItem value="YEAR" className="text-white hover:bg-slate-800">Por Año</SelectItem>
                        </SelectContent>
                    </Select>

                    {viewMode === 'YEAR' && (
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-[100px] bg-slate-900 border-slate-700 text-white">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                                {availableYears.map(year => (
                                    <SelectItem key={year} value={year.toString()} className="text-white hover:bg-slate-800">{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4 sticky left-0 bg-slate-950 z-10 w-[200px] uppercase tracking-wider text-[11px]">Concepto</th>
                                {activeColumns.map((col, i) => (
                                    <th key={i} className="px-4 py-4 text-center min-w-[100px] uppercase tracking-wider text-[11px] font-semibold text-slate-500">
                                        {format(col, 'MMM yy', { locale: es }).toUpperCase()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">

                            {/* --- INCOME SECTION --- */}
                            <tr className="bg-emerald-950/10 border-b border-emerald-900/20">
                                <td className="px-6 py-3 font-bold text-emerald-500 flex items-center gap-2 sticky left-0 bg-slate-900/50 backdrop-blur top-0 z-0">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                                    INGRESOS
                                </td>
                                <td colSpan={activeColumns.length} className="bg-slate-900/20"></td>
                            </tr>

                            <tr className="group hover:bg-slate-900/30 transition-colors">
                                <td className="px-6 py-2 text-slate-300 font-medium pl-10 sticky left-0 bg-slate-950/50 group-hover:bg-slate-900/80 transition-colors border-r border-slate-800/50">
                                    <span className="text-slate-600 mr-2">›</span> Alquileres
                                </td>
                                {activeIncomeRow.map((val, i) => (
                                    <td key={i} className="px-4 py-2 text-right text-slate-300 font-mono text-[13px]">
                                        {formatMoney(val)}
                                    </td>
                                ))}
                            </tr>

                            <tr className="bg-emerald-950/20 font-bold border-t border-emerald-900/30">
                                <td className="px-6 py-3 text-emerald-400 pl-10 sticky left-0 bg-slate-900/80 backdrop-blur border-r border-slate-800/50 uppercase text-[11px] tracking-wide">
                                    Total Ingresos
                                </td>
                                {activeIncomeRow.map((val, i) => (
                                    <td key={i} className="px-4 py-3 text-right text-emerald-400 font-mono text-[13px]">
                                        {formatMoney(val)}
                                    </td>
                                ))}
                            </tr>

                            {/* --- SPACER --- */}
                            <tr><td colSpan={100} className="py-2 bg-slate-950"></td></tr>

                            {/* --- EXPENSE SECTION --- */}
                            <tr className="bg-red-950/10 border-b border-red-900/20">
                                <td className="px-6 py-3 font-bold text-red-500 flex items-center gap-2 sticky left-0 bg-slate-900/50 backdrop-blur z-0">
                                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                                    GASTOS
                                </td>
                                <td colSpan={activeColumns.length} className="bg-slate-900/20"></td>
                            </tr>

                            {Array.from(activeExpenseRows.entries()).map(([catName, vals], i) => (
                                <tr key={i} className="group hover:bg-slate-900/30 transition-colors border-b border-slate-800/30 last:border-0">
                                    <td className="px-6 py-2 text-slate-300 font-medium pl-10 sticky left-0 bg-slate-950/50 group-hover:bg-slate-900/80 transition-colors border-r border-slate-800/50">
                                        <span className="text-slate-600 mr-2">›</span> {catName}
                                    </td>
                                    {vals.map((val, j) => (
                                        <td key={j} className="px-4 py-2 text-right text-slate-300 font-mono text-[13px]">
                                            {formatMoney(val)}
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            <tr className="bg-red-950/20 font-bold border-t border-red-900/30">
                                <td className="px-6 py-3 text-red-400 pl-10 sticky left-0 bg-slate-900/80 backdrop-blur border-r border-slate-800/50 uppercase text-[11px] tracking-wide">
                                    Total Gastos
                                </td>
                                {activeTotalExpensesRow.map((val, i) => (
                                    <td key={i} className="px-4 py-3 text-right text-red-400 font-mono text-[13px]">
                                        {formatMoney(val)}
                                    </td>
                                ))}
                            </tr>

                            {/* --- SPACER --- */}
                            <tr><td colSpan={100} className="py-2 bg-slate-950"></td></tr>

                            {/* --- NET SECTION --- */}
                            <tr className="bg-slate-900/80 font-bold border-y border-slate-700">
                                <td className="px-6 py-4 text-white uppercase tracking-wider sticky left-0 bg-slate-900 shadow-[4px_0_10px_rgba(0,0,0,0.5)] z-20">
                                    Resultado Neto
                                </td>
                                {activeNetRow.map((val, i) => (
                                    <td key={i} className={`px-4 py-4 text-right font-mono text-sm ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatMoney(val)}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-right text-xs text-slate-500 italic">
                * Valores expresados en {viewCurrency}. {viewCurrency === 'USD' ? 'Gastos en ARS convertidos al tipo de cambio histórico.' : 'Ingresos en USD convertidos al tipo de cambio histórico.'}
            </div>
        </div>
    );
}
