import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ConsolidatedCashflow {
    date: Date;
    incomeARS: number;
    incomeUSD: number;
    totalUSD: number;
    count: number;
    months?: ConsolidatedCashflow[]; // Nested monthly data
}

export function ConsolidatedCashflowTab({ showValues = true }: { showValues?: boolean }) {
    const [cashflows, setCashflows] = useState<ConsolidatedCashflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadCashflows();
    }, []);

    const toggleYear = (year: number) => {
        const newExpanded = new Set(expandedYears);
        if (newExpanded.has(year)) {
            newExpanded.delete(year);
        } else {
            newExpanded.add(year);
        }
        setExpandedYears(newExpanded);
    };

    const loadCashflows = async () => {
        try {
            const res = await fetch('/api/rentals/cashflows/consolidated');
            const data = await res.json();

            if (Array.isArray(data)) {
                // Group by Year
                const yearlyMap = data.reduce((acc: any, curr: ConsolidatedCashflow) => {
                    const year = new Date(curr.date).getFullYear();
                    if (!acc[year]) {
                        acc[year] = {
                            date: new Date(year, 0, 1),
                            incomeARS: 0,
                            incomeUSD: 0,
                            totalUSD: 0,
                            count: 0,
                            months: []
                        };
                    }
                    acc[year].incomeARS += curr.incomeARS;
                    acc[year].incomeUSD += curr.incomeUSD;
                    acc[year].totalUSD += curr.totalUSD;
                    acc[year].count += curr.count;
                    acc[year].months.push(curr); // Store monthly data
                    return acc;
                }, {});

                const sortedYears = Object.values(yearlyMap).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
                setCashflows(sortedYears as ConsolidatedCashflow[]);
            } else {
                console.error('Consolidated API returned non-array:', data);
                setCashflows([]);
            }
        } catch (error) {
            console.error('Error loading cashflows:', error);
            setCashflows([]);
        } finally {
            setLoading(false);
        }
    };

    const grandTotal = cashflows.reduce((acc, curr) => ({
        incomeARS: acc.incomeARS + curr.incomeARS,
        incomeUSD: acc.incomeUSD + curr.incomeUSD,
        totalUSD: acc.totalUSD + curr.totalUSD,
        count: acc.count + curr.count
    }), { incomeARS: 0, incomeUSD: 0, totalUSD: 0, count: 0 });

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Flujo Consolidado de Alquileres (Anual)</h2>
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : cashflows.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay cashflows proyectados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-3 px-4 text-slate-300 w-10"></th>
                                        <th className="text-left py-3 px-4 text-slate-300">Período</th>
                                        <th className="text-right py-3 px-4 text-slate-300">Alq. ARS</th>
                                        <th className="text-right py-3 px-4 text-slate-300">Alq. USD</th>
                                        <th className="text-right py-3 px-4 text-emerald-400">Total USD</th>
                                        <th className="text-center py-3 px-4 text-slate-300"># Ctos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cashflows.map((cfYear, idx) => {
                                        const year = new Date(cfYear.date).getFullYear();
                                        const isExpanded = expandedYears.has(year);

                                        return (
                                            <Fragment key={year}>
                                                {/* Year Row */}
                                                <tr
                                                    className="border-b border-slate-800 hover:bg-slate-900 cursor-pointer transition-colors"
                                                    onClick={() => toggleYear(year)}
                                                >
                                                    <td className="py-3 px-4 text-slate-400">
                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </td>
                                                    <td className="py-3 px-4 text-white font-bold text-lg">
                                                        {year}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-300 font-mono font-bold">
                                                        {showValues ? `$${cfYear.incomeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-300 font-mono font-bold">
                                                        {showValues ? `$${cfYear.incomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-emerald-400 font-bold font-mono text-lg">
                                                        {showValues ? `$${cfYear.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-slate-400">
                                                        {cfYear.count}
                                                    </td>
                                                </tr>

                                                {/* Monthly Rows */}
                                                {isExpanded && cfYear.months?.map((cfMonth, mIdx) => (
                                                    <tr key={`month-${year}-${mIdx}`} className="border-b border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/50">
                                                        <td className="py-2 px-4"></td> {/* Indent */}
                                                        <td className="py-2 px-4 text-slate-400 text-sm pl-8 border-l-2 border-slate-800">
                                                            {new Date(cfMonth.date).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-slate-500 font-mono text-sm">
                                                            {showValues ? `$${cfMonth.incomeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '****'}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-slate-500 font-mono text-sm">
                                                            {showValues ? `$${cfMonth.incomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                        </td>
                                                        <td className="py-2 px-4 text-right text-emerald-500/80 font-mono text-sm">
                                                            {showValues ? `$${cfMonth.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                                        </td>
                                                        <td className="py-2 px-4 text-center text-slate-600 text-sm">
                                                            {cfMonth.count}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 font-bold border-t-2 border-slate-700">
                                        <td></td>
                                        <td className="py-4 px-4 text-white text-lg">TOTAL HISTÓRICO</td>
                                        <td className="py-4 px-4 text-right text-white font-mono text-lg">
                                            {showValues ? `$${grandTotal.incomeARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className="py-4 px-4 text-right text-white font-mono text-lg">
                                            {showValues ? `$${grandTotal.incomeUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className="py-4 px-4 text-right text-emerald-400 font-mono text-lg">
                                            {showValues ? `$${grandTotal.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '****'}
                                        </td>
                                        <td className="py-4 px-4 text-center text-slate-300">
                                            {grandTotal.count}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
