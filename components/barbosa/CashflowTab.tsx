'use client';

import { useState, useEffect, Fragment } from 'react';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface CashflowTabProps {
    startDate?: string;
}

export function CashflowTab({ startDate }: CashflowTabProps) {
    const [viewMode, setViewMode] = useState<string>("LAST_12"); // "LAST_12" or "2025" etc
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // State for collapsible categories
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
    const [showStatistical, setShowStatistical] = useState(false);

    useEffect(() => {
        fetchData();
    }, [viewMode, startDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/barbosa/cashflow?';
            if (viewMode === 'LAST_12') {
                url += 'mode=LAST_12';
            } else {
                url += `mode=YEAR&year=${viewMode}`;
            }
            if (startDate) {
                url += `&startDate=${startDate}`;
            }
            const res = await fetch(url);
            const json = await res.json();
            if (json && json.periods && json.data) {
                setData(json);
            } else {
                setData(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;
    if (!data) return <div className="text-center text-slate-500">No data</div>;

    const periods = data.periods || []; // ["2024-01", "2024-02"...]

    // Helper: Format period label (e.g. "2024-01" -> "Ene 24")
    const formatPeriod = (p: string) => {
        const [y, m] = p.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        return date.toLocaleDateString('es-ES', { month: 'short', year: viewMode === 'LAST_12' ? '2-digit' : undefined }).toUpperCase();
    };

    // Helpers to access nested data safely
    const getValue = (type: string, cat: string, sub: string, period: string) => {
        const real = data.data[type]?.[cat]?.subs?.[sub]?.[period] || 0;
        const stat = data.data[type]?.[cat]?.subsStatistical?.[sub]?.[period] || 0;
        return {
            value: showStatistical ? (real + stat) : real,
            isStat: showStatistical && stat !== 0
        };
    };

    // Calculate Monthly Totals for Types (ALWAYS REAL ONLY for Grand Totals)
    const getMonthlyTotal = (type: string, period: string) => {
        let total = 0;
        const typeGroup = data.data[type] || {};
        Object.values(typeGroup).forEach((cat: any) => {
            total += cat.total[period] || 0;
            // Never add statistical to the grand total, per user request
        });
        return total;
    };

    const incomeTotal = (p: string) => getMonthlyTotal('INCOME', p);
    const expenseTotal = (p: string) => getMonthlyTotal('EXPENSE', p);
    const netTotal = (p: string) => incomeTotal(p) - expenseTotal(p);

    const toggleCategory = (catName: string) => {
        setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
    };

    const convert = (amount: number, p: string) => {
        if (currency === 'ARS') return amount;
        const rate = data.rates[p];
        return rate ? amount / rate : 0;
    };

    const formatMoney = (val: number) => {
        if (val === 0) return '-';
        if (currency === 'USD') return `US$${Math.round(val).toLocaleString()}`;
        return `$${Math.round(val).toLocaleString()}`;
    };

    // Render Rows for a Type (Grouped)
    const renderCategoryRows = (type: string) => {
        const typeGroup = data.data[type] || {};
        const categories = Object.keys(typeGroup).sort();

        return categories.map(catName => {
            const cat = typeGroup[catName];
            const isExpanded = expandedCategories[catName];

            // Merge subkeys from Real and Statistical to ensure we show all relevant subcategories
            const realSubs = Object.keys(cat.subs || {});
            const statSubs = Object.keys(cat.subsStatistical || {});
            const allSubKeys = Array.from(new Set([...realSubs, ...statSubs])).sort();

            const hasRealSubs = allSubKeys.length > 1 || (allSubKeys.length === 1 && allSubKeys[0] !== 'General');
            const hasSubs = hasRealSubs;

            // Calculate Category Totals (Real + Statistical if enabled)
            const catTotals = periods.map((p: string) => {
                const real = cat.total[p] || 0;
                const stat = cat.totalStatistical?.[p] || 0;
                return {
                    value: showStatistical ? (real + stat) : real,
                    isStat: showStatistical && stat !== 0
                };
            });

            return (
                <Fragment key={`${type}-${catName}`}>
                    {/* Category Header Row (Clickable) */}
                    <tr
                        key={`${type}-${catName}`}
                        className={`hover:bg-slate-900/50 border-b border-slate-900 group ${hasSubs ? 'cursor-pointer' : ''}`}
                        onClick={() => hasSubs && toggleCategory(catName)}
                    >
                        <td className="px-4 py-2 text-slate-300 font-bold border-r border-slate-800 flex items-center gap-2 group-hover:text-white">
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${!hasSubs ? 'invisible' : ''}`}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </div>
                            {catName}
                        </td>
                        {catTotals.map((item: { value: number, isStat: boolean }, idx: number) => {
                            const p = periods[idx];
                            const converted = convert(item.value, p);
                            return (
                                <td key={idx} className={`px-2 py-2 text-right font-mono text-xs font-semibold ${item.isStat ? 'text-indigo-400' : 'text-slate-300'}`}>
                                    {formatMoney(converted)}
                                </td>
                            );
                        })}
                    </tr>

                    {/* SubCategories List (Collapsible) */}
                    {isExpanded && allSubKeys.map(subName => (
                        <tr key={`${type}-${catName}-${subName}`} className="bg-slate-950/30 hover:bg-slate-900/50 border-b border-slate-900 last:border-0 animate-in fade-in slide-in-from-top-1">
                            <td className="px-4 py-1 text-slate-400 font-medium border-r border-slate-800 pl-12 text-xs border-l-4 border-l-slate-900">
                                {subName}
                            </td>
                            {periods.map((p: string) => {
                                const { value, isStat } = getValue(type, catName, subName, p);
                                const converted = convert(value, p);
                                return (
                                    <td key={p} className={`px-2 py-1 text-right font-mono text-[10px] ${isStat ? 'text-indigo-400' : 'text-slate-400'}`}>
                                        {formatMoney(converted)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </Fragment>
            );
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-900 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Cashflow Anual</h2>
                    <p className="text-xs text-slate-500">Resumen financiero detallado</p>
                </div>

                <div className="flex items-center gap-6">

                    {/* Statistical Toggle */}
                    <div className="flex items-center space-x-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                        <Checkbox
                            id="statistical"
                            checked={showStatistical}
                            onCheckedChange={(checked) => setShowStatistical(checked === true)}
                            className="data-[state=checked]:bg-indigo-600 border-slate-600"
                        />
                        <label
                            htmlFor="statistical"
                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300 cursor-pointer"
                        >
                            Incluir Estadísticos
                        </label>
                    </div>

                    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                        <button
                            onClick={() => setCurrency('ARS')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currency === 'ARS'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
                        >
                            ARS
                        </button>
                        <button
                            onClick={() => setCurrency('USD')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currency === 'USD'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'}`}
                        >
                            USD
                        </button>
                    </div>

                    <Select value={viewMode} onValueChange={setViewMode}>
                        <SelectTrigger className="w-[180px] bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border-blue-800/50 text-blue-100 ring-offset-0 focus:ring-2 focus:ring-blue-500 font-medium">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                            <SelectItem value="LAST_12" className="text-emerald-400 font-medium">Últimos 12 meses</SelectItem>
                            <SelectItem value="2024">Año 2024</SelectItem>
                            <SelectItem value="2025">Año 2025</SelectItem>
                            <SelectItem value="2026">Año 2026</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-x-auto shadow-xl bg-slate-950/50">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase font-bold text-[10px] tracking-wider sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="px-4 py-3 min-w-[200px] border-r border-slate-800">Concepto</th>
                            {periods.map((p: string) => (
                                <th key={p} className="px-2 py-3 text-right min-w-[80px]">{formatPeriod(p)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-slate-950 text-sm">
                        {/* INGRESOS */}
                        <tr className="bg-emerald-950/30 text-emerald-400 font-bold">
                            <td className="px-4 py-2 border-r border-slate-800 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                INGRESOS
                            </td>
                            <td colSpan={periods.length}></td>
                        </tr>
                        {renderCategoryRows('INCOME')}
                        <tr className="bg-slate-900 font-bold text-emerald-400 border-t border-slate-800">
                            <td className="px-4 py-2 text-right border-r border-slate-800">TOTAL INGRESOS</td>
                            {periods.map((p: string) => (
                                <td key={p} className="px-2 py-2 text-right text-xs">
                                    {formatMoney(convert(incomeTotal(p), p))}
                                </td>
                            ))}
                        </tr>

                        {/* GASTOS */}
                        <tr className="bg-red-950/30 text-red-400 font-bold border-t border-slate-800 mt-4">
                            <td className="px-4 py-2 border-r border-slate-800 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                GASTOS
                            </td>
                            <td colSpan={periods.length}></td>
                        </tr>
                        {renderCategoryRows('EXPENSE')}
                        <tr className="bg-slate-900 font-bold text-red-400 border-t border-slate-800">
                            <td className="px-4 py-2 text-right border-r border-slate-800">TOTAL GASTOS</td>
                            {periods.map((p: string) => (
                                <td key={p} className="px-2 py-2 text-right text-xs">
                                    {formatMoney(convert(expenseTotal(p), p))}
                                </td>
                            ))}
                        </tr>

                        {/* RESULTADO (AHORRO) */}
                        <tr className="bg-slate-800 text-white font-bold border-t-4 border-slate-800 shadow-inner">
                            <td className="px-4 py-3 text-right border-r border-slate-700">AHORRO ({currency})</td>
                            {periods.map((p: string) => {
                                const net = netTotal(p);
                                const converted = convert(net, p);
                                return (
                                    <td key={p} className={`px-2 py-3 text-right text-xs ${converted >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatMoney(converted)}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* TC USD (Visible always if USD mode for context, or just ARS?) User asked to see it "when seeing in USD" */}
                        {(currency === 'ARS' || currency === 'USD') && (
                            <tr className="bg-slate-950 text-slate-500 font-mono text-xs border-t border-slate-800">
                                <td className="px-4 py-2 text-right border-r border-slate-800">TIPO DE CAMBIO</td>
                                {periods.map((p: string) => (
                                    <td key={p} className="px-2 py-2 text-right">
                                        {data.rates[p] ? `$${data.rates[p]}` : '-'}
                                    </td>
                                ))}
                            </tr>
                        )}

                        {/* AHORRO % */}
                        <tr className="bg-slate-900 text-blue-400 font-bold text-xs border-t border-slate-800">
                            <td className="px-4 py-2 text-right border-r border-slate-800">AHORRO %</td>
                            {periods.map((p: string) => {
                                const inc = incomeTotal(p);
                                const net = netTotal(p);
                                const percent = inc > 0 ? (net / inc) * 100 : 0;
                                return (
                                    <td key={p} className={`px-2 py-2 text-right ${percent >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                        {Math.round(percent)}%
                                    </td>
                                );
                            })}
                        </tr>

                    </tbody>
                </table>
            </div>
        </div>
    );
}
