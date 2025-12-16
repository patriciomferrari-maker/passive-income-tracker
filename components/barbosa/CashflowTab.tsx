'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

export function CashflowTab() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // State for collapsible categories
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    useEffect(() => {
        fetchData();
    }, [year]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/barbosa/cashflow?year=${year}`);
            const json = await res.json();
            setData(json.data);
            // We also need rates which are in json.rates, so let's store whole json
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;
    if (!data) return <div className="text-center text-slate-500">No data</div>;

    // Helpers to access nested data safely
    const getValue = (type: string, cat: string, sub: string, month: number) => {
        return data.data[type]?.[cat]?.subs?.[sub]?.[month] || 0;
    };

    // Calculate Monthly Totals for Types
    const getMonthlyTotal = (type: string, month: number) => {
        let total = 0;
        const typeGroup = data.data[type] || {};
        Object.values(typeGroup).forEach((cat: any) => {
            total += cat.total[month] || 0;
        });
        return total;
    };

    const incomeTotal = (m: number) => getMonthlyTotal('INCOME', m);
    const netTotal = (m: number) => incomeTotal(m) - expenseTotal(m);

    const toggleCategory = (catName: string) => {
        setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
    };

    // Render Rows for a Type (Grouped)
    const renderCategoryRows = (type: string) => {
        const typeGroup = data.data[type] || {};
        return Object.keys(typeGroup).map(catName => {
            const cat = typeGroup[catName];
            const isExpanded = expandedCategories[catName];

            // Calculate Category Totals
            const catTotals = months.map(m => cat.total[m] || 0);

            return (
                <>
                    {/* Category Header Row (Clickable) */}
                    <tr
                        key={`${type}-${catName}`}
                        className="hover:bg-slate-900/50 border-b border-slate-900 cursor-pointer"
                        onClick={() => toggleCategory(catName)}
                    >
                        <td className="px-4 py-2 text-slate-300 font-bold border-r border-slate-800 flex items-center gap-2">
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </div>
                            {catName}
                        </td>
                        {catTotals.map((val, idx) => (
                            <td key={idx} className="px-2 py-2 text-right text-slate-300 font-mono text-xs font-semibold">
                                {val > 0 ? `$${val.toLocaleString()}` : '-'}
                            </td>
                        ))}
                    </tr>

                    {/* SubCategories List (Collapsible) */}
                    {isExpanded && Object.keys(cat.subs).map(subName => (
                        <tr key={`${type}-${catName}-${subName}`} className="bg-slate-950/50 hover:bg-slate-900/50 border-b border-slate-900 last:border-00 animate-in fade-in slide-in-from-top-1">
                            <td className="px-4 py-1 text-slate-500 font-medium border-r border-slate-800 pl-8 text-xs">
                                {subName}
                            </td>
                            {months.map(m => (
                                <td key={m} className="px-2 py-1 text-right text-slate-500 font-mono text-[10px]">
                                    {getValue(type, catName, subName, m) > 0 ? `$${getValue(type, catName, subName, m).toLocaleString()}` : '-'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </>
            );
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Cashflow Anual</h2>
                <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
                    <SelectTrigger className="w-[120px] bg-slate-950 border-slate-800">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-4 py-3 min-w-[200px] border-r border-slate-800">Concepto</th>
                            {monthNames.map(m => (
                                <th key={m} className="px-2 py-3 text-right min-w-[80px]">{m}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-slate-950 text-sm">
                        {/* INGRESOS */}
                        <tr className="bg-emerald-950/20 text-emerald-400 font-bold">
                            <td className="px-4 py-2 border-r border-slate-800">INGRESOS</td>
                            <td colSpan={12}></td>
                        </tr>
                        {renderCategoryRows('INCOME')}
                        <tr className="bg-slate-900 font-bold text-emerald-400 border-t border-slate-800">
                            <td className="px-4 py-2 text-right border-r border-slate-800">TOTAL INGRESOS</td>
                            {months.map(m => (
                                <td key={m} className="px-2 py-2 text-right text-xs">
                                    ${incomeTotal(m).toLocaleString()}
                                </td>
                            ))}
                        </tr>

                        {/* GASTOS */}
                        <tr className="bg-red-950/20 text-red-400 font-bold border-t border-slate-800 mt-4">
                            <td className="px-4 py-2 border-r border-slate-800">GASTOS</td>
                            <td colSpan={12}></td>
                        </tr>
                        {renderCategoryRows('EXPENSE')}
                        <tr className="bg-slate-900 font-bold text-red-400 border-t border-slate-800">
                            <td className="px-4 py-2 text-right border-r border-slate-800">TOTAL GASTOS</td>
                            {months.map(m => (
                                <td key={m} className="px-2 py-2 text-right text-xs">
                                    ${expenseTotal(m).toLocaleString()}
                                </td>
                            ))}
                        </tr>

                        {/* NETO ARS */}
                        <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-700">
                            <td className="px-4 py-3 text-right border-r border-slate-700">AHORRO</td>
                            {months.map(m => (
                                <td key={m} className={`px-2 py-3 text-right text-xs ${netTotal(m) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ${netTotal(m).toLocaleString()}
                                </td>
                            ))}
                        </tr>

                        {/* TC USD */}
                        <tr className="bg-slate-950 text-slate-500 font-mono text-xs border-t border-slate-800">
                            <td className="px-4 py-2 text-right border-r border-slate-800">TIPO DE CAMBIO</td>
                            {months.map(m => (
                                <td key={m} className="px-2 py-2 text-right">
                                    {data.rates[m] ? `$${data.rates[m]}` : '-'}
                                </td>
                            ))}
                        </tr>

                        {/* RESULTADO USD */}
                        <tr className="bg-slate-900 text-blue-300 font-bold border-t border-slate-800">
                            <td className="px-4 py-3 text-right border-r border-slate-800">Ahorro USD</td>
                            {months.map(m => {
                                const net = netTotal(m);
                                const rate = data.rates[m];
                                const usd = rate ? net / rate : 0;
                                return (
                                    <td key={m} className="px-2 py-3 text-right text-xs">
                                        {rate ? `US$${Math.round(usd).toLocaleString()}` : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                        {/* GASTOS USD */}
                        <tr className="bg-slate-900 text-purple-300 font-bold border-t border-slate-800">
                            <td className="px-4 py-3 text-right border-r border-slate-800">GASTOS (USD)</td>
                            {months.map(m => {
                                const exp = expenseTotal(m);
                                const rate = data.rates[m];
                                const usd = rate ? exp / rate : 0;
                                return (
                                    <td key={m} className="px-2 py-3 text-right text-xs">
                                        {rate ? `US$${Math.round(usd).toLocaleString()}` : '-'}
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
