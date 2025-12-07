'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface MonthlyCashflow {
    date: string;
    amount: number;
    interest: number;
    amortization: number;
}

interface YearlyGroup {
    year: string;
    total: number;
    months: MonthlyCashflow[];
}

export function ConsolidatedCashflowTab() {
    const [cashflows, setCashflows] = useState<MonthlyCashflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);
    const [expandedYears, setExpandedYears] = useState<string[]>([]);

    useEffect(() => {
        loadCashflows();
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }

        const handlePrivacyChange = () => {
            const savedPrivacy = localStorage.getItem('privacy_mode');
            if (savedPrivacy !== null) {
                setShowValues(savedPrivacy === 'true');
            }
        };
        window.addEventListener('privacy-changed', handlePrivacyChange);
        return () => window.removeEventListener('privacy-changed', handlePrivacyChange);
    }, []);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
        window.dispatchEvent(new Event('privacy-changed'));
    };

    const toggleYear = (year: string) => {
        setExpandedYears(prev =>
            prev.includes(year)
                ? prev.filter(y => y !== year)
                : [...prev, year]
        );
    };

    const formatMoney = (amount: number) => {
        if (!showValues) return '****';
        return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const loadCashflows = async () => {
        try {
            const res = await fetch('/api/investments/cashflows');
            const data = await res.json();
            setCashflows(data);
            // Auto-expand current year
            const currentYear = new Date().getFullYear().toString();
            setExpandedYears([currentYear]);
        } catch (error) {
            console.error('Error loading consolidated cashflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const chartData = showValues ? cashflows.map(cf => ({
        month: format(new Date(cf.date), 'MMM yyyy', { locale: es }),
        Interés: cf.interest,
        Amortización: cf.amortization,
        Total: cf.amount
    })) : [];

    // Group by Year
    const groupedByYear: YearlyGroup[] = cashflows.reduce((acc, curr) => {
        const year = new Date(curr.date).getFullYear().toString();
        const existingYear = acc.find(y => y.year === year);

        if (existingYear) {
            existingYear.total += curr.amount;
            existingYear.months.push(curr);
        } else {
            acc.push({
                year,
                total: curr.amount,
                months: [curr]
            });
        }
        return acc;
    }, [] as YearlyGroup[]);

    return (
        <div className="space-y-6">
            {/* Chart */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white">Proyección de Cobros Mensual</CardTitle>
                        <button
                            onClick={togglePrivacy}
                            className="p-2 bg-slate-700 rounded-md text-slate-300 hover:text-white"
                            title={showValues ? "Ocultar montos" : "Mostrar montos"}
                        >
                            {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    <CardDescription className="text-slate-300">
                        Distribución mensual consolidada de intereses y amortizaciones
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                <XAxis
                                    dataKey="month"
                                    stroke="#e2e8f0"
                                    angle={-45}
                                    textAnchor="end"
                                    height={100}
                                    style={{ fill: '#e2e8f0', fontSize: '11px' }}
                                    hide={!showValues}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tickFormatter={(value) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                    scale="sqrt"
                                    domain={['auto', 'auto']}
                                    hide={!showValues}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                    formatter={(value: number) => formatMoney(value)}
                                />
                                <Legend />
                                <Bar dataKey="Interés" stackId="a" fill="#22c55e" />
                                <Bar dataKey="Amortización" stackId="a" fill="#3b82f6">
                                    <LabelList
                                        dataKey="Total"
                                        position="top"
                                        formatter={(value: any) => showValues ? `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''}
                                        style={{ fill: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Table Grouped by Year */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader>
                    <CardTitle className="text-white">Detalle de Cobros por Año</CardTitle>
                </CardHeader>
                <CardContent>
                    {!showValues ? (
                        <div className="text-slate-400 text-center py-12">
                            Valores ocultos por privacidad
                        </div>
                    ) : loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : cashflows.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay flujos de fondos proyectados.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {groupedByYear.map((yearGroup) => (
                                <div key={yearGroup.year} className="border border-white/10 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleYear(yearGroup.year)}
                                        className="w-full bg-white/5 p-4 flex justify-between items-center hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            {expandedYears.includes(yearGroup.year) ? (
                                                <ChevronDown className="h-5 w-5 text-slate-300" />
                                            ) : (
                                                <ChevronRight className="h-5 w-5 text-slate-300" />
                                            )}
                                            <h3 className="text-lg font-bold text-white">Año {yearGroup.year}</h3>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-white font-bold font-mono">
                                                {formatMoney(yearGroup.total)}
                                            </span>
                                        </div>
                                    </button>

                                    {expandedYears.includes(yearGroup.year) && (
                                        <div className="overflow-x-auto border-t border-white/10">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-white/10 bg-black/20">
                                                        <th className="text-left py-2 px-4 text-slate-400 font-medium text-sm">Mes</th>
                                                        <th className="text-right py-2 px-4 text-slate-400 font-medium text-sm">Interés</th>
                                                        <th className="text-right py-2 px-4 text-slate-400 font-medium text-sm">Amortización</th>
                                                        <th className="text-right py-2 px-4 text-slate-400 font-medium text-sm">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {yearGroup.months.map((cf, idx) => (
                                                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                                            <td className="py-2 px-4 text-white font-medium">
                                                                {format(new Date(cf.date), 'MMMM', { locale: es })}
                                                            </td>
                                                            <td className="py-2 px-4 text-green-400 text-right font-mono text-sm">
                                                                {formatMoney(cf.interest)}
                                                            </td>
                                                            <td className="py-2 px-4 text-blue-400 text-right font-mono text-sm">
                                                                {formatMoney(cf.amortization)}
                                                            </td>
                                                            <td className="py-2 px-4 text-white text-right font-bold font-mono text-sm">
                                                                {formatMoney(cf.amount)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-white/5 border-t border-white/10">
                                                        <td className="py-3 px-4 text-white font-bold text-right">TOTAL {yearGroup.year}</td>
                                                        <td className="py-3 px-4 text-green-400 text-right font-bold font-mono text-sm">
                                                            {formatMoney(yearGroup.months.reduce((sum, m) => sum + m.interest, 0))}
                                                        </td>
                                                        <td className="py-3 px-4 text-blue-400 text-right font-bold font-mono text-sm">
                                                            {formatMoney(yearGroup.months.reduce((sum, m) => sum + m.amortization, 0))}
                                                        </td>
                                                        <td className="py-3 px-4 text-white text-right font-bold font-mono text-lg">
                                                            {formatMoney(yearGroup.total)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Grand Total Footer */}
                            <div className="bg-white/10 p-6 rounded-lg border border-white/20 mt-8">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-white">TOTAL GENERAL</h3>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 font-mono">
                                            {formatMoney(cashflows.reduce((sum, cf) => sum + cf.amount, 0))}
                                        </div>
                                        <div className="text-sm text-slate-400 mt-1">
                                            Interés: {formatMoney(cashflows.reduce((sum, cf) => sum + cf.interest, 0))} |
                                            Amortización: {formatMoney(cashflows.reduce((sum, cf) => sum + cf.amortization, 0))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
