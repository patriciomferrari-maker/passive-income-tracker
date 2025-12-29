'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function InstallmentsEvolutionTable() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // State for expanded rows: key can be "CatName" or "CatName-SubName"
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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
        const monthsSet = new Set<string>();
        // Structure:
        // Cat -> { total, subs: { Sub -> { total, concepts: { ConceptName -> { total } } } } }
        const hierarchy: Record<string, any> = {};

        plans.forEach(plan => {
            const catName = plan.category.name;
            const subName = plan.subCategory?.name || 'Varios'; // Group header
            const conceptName = plan.description; // The Plan Name (e.g. "iPhone 15")

            if (!hierarchy[catName]) {
                hierarchy[catName] = { total: {}, subs: {} };
            }
            if (!hierarchy[catName].subs[subName]) {
                hierarchy[catName].subs[subName] = { total: {}, concepts: {} };
            }
            if (!hierarchy[catName].subs[subName].concepts[conceptName]) {
                hierarchy[catName].subs[subName].concepts[conceptName] = { total: {} };
            }

            plan.transactions.forEach((tx: any) => {
                const date = new Date(tx.date);
                const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                monthsSet.add(key);
                const amount = tx.amount;

                // 1. Cat Total
                hierarchy[catName].total[key] = (hierarchy[catName].total[key] || 0) + amount;
                // 2. Sub Total
                hierarchy[catName].subs[subName].total[key] = (hierarchy[catName].subs[subName].total[key] || 0) + amount;
                // 3. Concept Total
                hierarchy[catName].subs[subName].concepts[conceptName].total[key] = (hierarchy[catName].subs[subName].concepts[conceptName].total[key] || 0) + amount;
            });
        });

        const sortedMonths = Array.from(monthsSet).sort();
        setData({ hierarchy, months: sortedMonths });
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
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
                            <th className="px-4 py-3 sticky left-0 bg-slate-900 z-10 text-left min-w-[250px] border-r border-slate-800">Concepto</th>
                            {months.map((m: string) => (
                                <th key={m} className="px-2 py-3 min-w-[80px]">{formatMonth(m)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/30 font-mono text-xs">
                        {categories.map(cat => {
                            const catData = hierarchy[cat];
                            const isCatExpanded = expandedRows[cat];
                            const subs = Object.keys(catData.subs).sort();

                            return (
                                <>
                                    {/* LEVEL 1: CATEGORY */}
                                    <tr
                                        className={`hover:bg-slate-900/50 transition-colors cursor-pointer group ${isCatExpanded ? 'bg-slate-900/30' : ''}`}
                                        onClick={() => toggleRow(cat)}
                                    >
                                        <td className="px-4 py-3 font-bold text-white border-r border-slate-800 sticky left-0 bg-slate-950 group-hover:bg-slate-900/50 flex items-center gap-2">
                                            <div className={`transition-transform text-slate-500 ${isCatExpanded ? 'rotate-90' : ''}`}>
                                                <ChevronRight size={14} />
                                            </div>
                                            {cat}
                                        </td>
                                        {months.map((m: string) => (
                                            <td key={m} className={`px-2 py-3 text-right ${catData.total[m] ? 'text-white font-bold' : 'text-slate-600'}`}>
                                                {catData.total[m] ? `$${catData.total[m].toLocaleString()}` : '-'}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* LEVEL 2: SUBCATEGORY */}
                                    {isCatExpanded && subs.map(sub => {
                                        const subId = `${cat}-${sub}`;
                                        const isSubExpanded = expandedRows[subId];
                                        const subData = catData.subs[sub];
                                        const concepts = Object.keys(subData.concepts).sort();

                                        return (
                                            <>
                                                <tr
                                                    key={subId}
                                                    className="bg-slate-900/20 hover:bg-slate-900/40 cursor-pointer animate-in fade-in slide-in-from-top-1"
                                                    onClick={() => toggleRow(subId)}
                                                >
                                                    <td className="px-4 py-2 pl-10 text-slate-300 font-medium border-r border-slate-800 sticky left-0 bg-slate-950/95 border-l-4 border-l-slate-800 flex items-center gap-2">
                                                        <div className={`transition-transform text-slate-500 ${isSubExpanded ? 'rotate-90' : ''}`}>
                                                            <ChevronRight size={12} />
                                                        </div>
                                                        {sub}
                                                    </td>
                                                    {months.map((m: string) => (
                                                        <td key={m} className="px-2 py-2 text-right text-slate-400">
                                                            {subData.total[m] ? `$${subData.total[m].toLocaleString()}` : '-'}
                                                        </td>
                                                    ))}
                                                </tr>

                                                {/* LEVEL 3: CONCEPTS (Individual Plans) */}
                                                {isSubExpanded && concepts.map(concept => (
                                                    <tr key={`${subId}-${concept}`} className="bg-slate-900/10 hover:bg-slate-900/30 animate-in fade-in slide-in-from-top-1">
                                                        <td className="px-4 py-1 pl-16 text-slate-500 border-r border-slate-800 sticky left-0 bg-slate-950/90 border-l border-l-slate-800/50">
                                                            {concept}
                                                        </td>
                                                        {months.map((m: string) => (
                                                            <td key={m} className="px-2 py-1 text-right text-slate-600 text-[10px]">
                                                                {subData.concepts[concept].total[m] ? `$${subData.concepts[concept].total[m].toLocaleString()}` : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </>
                                        );
                                    })}
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
