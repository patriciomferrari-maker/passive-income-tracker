'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Loader2, Table } from 'lucide-react';

export function InstallmentsTab() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await fetch('/api/barbosa/installments');
            const data = await res.json();
            setPlans(data);
            prepareChartData(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const prepareChartData = (plans: any[]) => {
        // We want to verify the EVOLUTION of installments payment
        // We need to aggregate ALL transactions (REAL + PROJECTED) from ALL Active plans by month.
        const monthlySum: Record<string, number> = {};

        plans.forEach(plan => {
            // Skip finished plans for the projection chart if we only care about FUTURE cashflow?
            // Actually, "Evolution" usually implies showing past payments too.
            // So let's include everything from active plans, or recent history + future.

            // Let's filter to only include transactions from active plans OR young finished plans? as user prefers.
            // For "Evolution", let's show EVERYTHING (Active + Finished) to show the load dropping? 
            // Or just Active? Let's assume Active for "What do I have to pay".

            if (plan.isFinished) return;

            plan.transactions.forEach((tx: any) => {
                const date = new Date(tx.date);
                // Adjust timezone to simpler keys
                const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                monthlySum[key] = (monthlySum[key] || 0) + tx.amount;
            });
        });

        // Convert to array and sort
        const chart = Object.keys(monthlySum).sort().map(key => {
            const [y, m] = key.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1, 1);
            return {
                name: format(date, 'MMM yy').toUpperCase(), // ENE 25
                date: key, // for sorting
                amount: monthlySum[key]
            };
        });

        setChartData(chart);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;

    const activePlans = plans.filter(p => !p.isFinished);
    const finishedPlans = plans.filter(p => p.isFinished);

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-bold text-white">Evolución de Cuotas</h2>

            {/* CHART */}
            <Card className="bg-slate-900 border-slate-800 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-400">Proyección Mensual (Planes Activos)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '8px' }}
                                    itemStyle={{ color: '#60a5fa' }}
                                    formatter={(val: number) => [`$${val.toLocaleString()}`, 'Total Cuotas']}
                                />
                                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                            No hay proyección de cuotas activas
                        </div>
                    )}
                </CardContent>
            </Card>


            {/* ACTIVE PLANS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePlans.map(plan => (
                    <Card key={plan.id} className="bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-colors">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="overflow-hidden">
                                    <h3 className="font-bold text-white truncate">{plan.description}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{plan.category.name}</Badge>
                                        {plan.subCategory && <span className="text-xs text-slate-600">{plan.subCategory.name}</span>}
                                    </div>
                                </div>
                                <div className="text-right whitespace-nowrap ml-4">
                                    <div className="text-lg font-mono font-bold text-blue-400">
                                        {plan.currency === 'USD' ? 'US$' : '$'}{plan.totalAmount.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Plan</div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Progress Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Progreso ({plan.paidCount} de {plan.installmentsCount})</span>
                                    <span>{Math.round(plan.progress)}%</span>
                                </div>
                                <Progress value={plan.progress} className="h-2 bg-slate-900" indicatorClassName="bg-blue-600" />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-900/50 p-2 rounded border border-slate-900/50">
                                    <span className="block text-slate-500 mb-1">Pagado</span>
                                    <span className="font-bold text-emerald-400 text-sm">${plan.paidAmount.toLocaleString()}</span>
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded border border-slate-900/50">
                                    <span className="block text-slate-500 mb-1">Restante</span>
                                    <span className="font-bold text-red-400 text-sm">${(plan.totalAmount - plan.paidAmount).toLocaleString()}</span>
                                </div>
                            </div>

                            {plan.nextDueDate && (
                                <div className="text-xs text-slate-500 pt-3 border-t border-slate-900 flex justify-between items-center">
                                    <span>Próx. vencimiento:</span>
                                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 hover:bg-slate-700">
                                        {format(new Date(plan.nextDueDate), 'dd/MM/yyyy')}
                                    </Badge>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* DETAILED BREAKDOWN TABLE */}
            {activePlans.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Table size={14} /> Detalle Abierto
                    </h3>
                    <div className="border border-slate-800 rounded-lg overflow-hidden shadow-lg">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="bg-slate-900 text-xs text-slate-400 uppercase font-bold">
                                <tr>
                                    <th className="px-4 py-3">Descripción</th>
                                    <th className="px-4 py-3">Categoría</th>
                                    <th className="px-4 py-3 text-right">Avance</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Restante</th>
                                    <th className="px-4 py-3 text-right">Próx. Venc.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                                {activePlans.map((plan) => (
                                    <tr key={plan.id} className="hover:bg-slate-900/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-white">{plan.description}</td>
                                        <td className="px-4 py-3 text-slate-400">
                                            {plan.category.name}
                                            {plan.subCategory && <span className="text-slate-600 block text-xs">{plan.subCategory.name}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs">{plan.paidCount}/{plan.installmentsCount}</span>
                                                <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${plan.progress}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                                            ${plan.totalAmount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-red-400 font-medium">
                                            ${(plan.totalAmount - plan.paidAmount).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs">
                                            {plan.nextDueDate ? format(new Date(plan.nextDueDate), 'dd MMM yyyy') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* FINISHED PLANS */}
            {finishedPlans.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-900">
                    <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Historial Finalizados</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {finishedPlans.map(plan => (
                            <div key={plan.id} className="bg-slate-900/30 p-3 rounded-lg border border-slate-900 opacity-60 hover:opacity-100 transition-opacity">
                                <h4 className="text-slate-400 font-bold text-sm truncate">{plan.description}</h4>
                                <div className="flex justify-between mt-2 text-xs">
                                    <span className="text-slate-500">Total: ${plan.totalAmount.toLocaleString()}</span>
                                    <span className="text-emerald-600 font-bold">✓ Completado</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
