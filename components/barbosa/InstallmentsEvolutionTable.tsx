'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function InstallmentsEvolutionTable() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetch('/api/barbosa/installments')
            .then(res => res.json())
            .then(json => {
                processData(json);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const processData = (plans: any[]) => {
        // We need a matrix: Rows = Category/Subcat, Cols = Months
        // 1. Identify all months range (from min date to max date in transactions)
        // 2. Aggregate data

        const monthsSet = new Set<string>();
        const hierarchy: Record<string, { total: Record<string, number>, subs: Record<string, Record<string, number>> }> = {};

        plans.forEach(plan => {
            const catName = plan.category.name;
            const subName = plan.subCategory?.name || 'General';

            if (!hierarchy[catName]) {
                hierarchy[catName] = { total: {}, subs: {} };
            }
            if (!hierarchy[catName].subs[subName]) {
                hierarchy[catName].subs[subName] = {};
            }

            plan.transactions.forEach((tx: any) => {
                const date = new Date(tx.date);
                const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                monthsSet.add(key);

                // Add to Category Total
                hierarchy[catName].total[key] = (hierarchy[catName].total[key] || 0) + tx.amount;
                // Add to Subcategory
                hierarchy[catName].subs[subName][key] = (hierarchy[catName].subs[subName][key] || 0) + tx.amount;
            });
        });

        // Sort months
        const sortedMonths = Array.from(monthsSet).sort();

        // If we want a fixed range (e.g. next 12 months), we could filter or generate here.
        // For now, let's just use the data range.

        setData({ hierarchy, months: sortedMonths });
    };

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;
    if (!data) return <div className="text-center text-slate-500">No data available</div>;

    const { hierarchy, months } = data;
    const categories = Object.keys(hierarchy).sort();

    const formatMonth = (key: string) => {
        const [y, m] = key.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, 1);
        return format(date, 'MMM yy', { locale: es }).toUpperCase();
    };

    return (
        <Card className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-lg mt-6">
            <div className="p-4 border-b border-slate-900 bg-slate-900/50">
                <h3 className="text-lg font-bold text-white">Detalle Evolutivo por Categoría</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-900 text-xs text-slate-400 uppercase font-bold text-center">
                        <tr>
                            <th className="px-4 py-3 sticky left-0 bg-slate-900 z-10 text-left min-w-[200px] border-r border-slate-800">CConcepto</th>
                            {months.map((m: string) => (
                                <th key={m} className="px-2 py-3 min-w-[80px]">{formatMonth(m)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/30 font-mono text-xs">
                        {categories.map(cat => {
                            const catData = hierarchy[cat];
                            const isExpanded = expandedCategories[cat];
                            const subs = Object.keys(catData.subs).sort();
                            const hasSubs = subs.length > 1 || (subs.length === 1 && subs[0] !== 'General');

                            return (
                                <>
                                    {/* Category Row */}
                                    <tr
                                        className={`hover:bg-slate-900/50 transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-900/30' : ''}`}
                                        onClick={() => toggleCategory(cat)}
                                    >
                                        <td className="px-4 py-2 font-bold text-white border-r border-slate-800 sticky left-0 bg-slate-950 group-hover:bg-slate-900/50 flex items-center gap-2">
                                            <div className={`transition-transform text-slate-500 ${isExpanded ? 'rotate-90' : ''}`}>
                                                {hasSubs ? <ChevronRight size={14} /> : <div className="w-[14px]" />}
                                            </div>
                                            {cat}
                                        </td>
                                        {months.map((m: string) => (
                                            <td key={m} className="px-2 py-2 text-right">
                                                {catData.total[m] ? `$${catData.total[m].toLocaleString()}` : '-'}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Subcategories */}
                                    {isExpanded && subs.map(sub => (
                                        <tr key={`${cat}-${sub}`} className="bg-slate-900/10 hover:bg-slate-900/30 animate-in fade-in slide-in-from-top-1">
                                            <td className="px-4 py-1 pl-10 text-slate-400 border-r border-slate-800 sticky left-0 bg-slate-950/95 border-l-4 border-l-slate-800">
                                                {sub}
                                            </td>
                                            {months.map((m: string) => (
                                                <td key={m} className="px-2 py-1 text-right text-slate-500">
                                                    {catData.subs[sub][m] ? `$${catData.subs[sub][m].toLocaleString()}` : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </>
                            );
                        })}
                        {/* Grand Total Row */}
                        <tr className="bg-slate-900 font-bold text-emerald-400 border-t-2 border-slate-700">
                            <td className="px-4 py-3 border-r border-slate-800 sticky left-0 bg-slate-900">TOTAL</td>
                            {months.map((m: string) => {
                                const total = categories.reduce((sum, cat) => sum + (hierarchy[cat].total[m] || 0), 0);
                                return (
                                    <td key={m} className="px-2 py-3 text-right">
                                        {total > 0 ? `$${total.toLocaleString()}` : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
