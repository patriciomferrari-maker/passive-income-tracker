'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Loader2 } from 'lucide-react';

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
        // We need to aggregate ALL transactions from ALL plans by month.
        const monthlySum: Record<string, number> = {};

        plans.forEach(plan => {
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

        // Filter: Show from "Last Month" to "Next 12 Months" maybe?
        // Or just show full timeline of active plans?
        // Let's show everything for now.
        setChartData(chart);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;

    const activePlans = plans.filter(p => !p.isFinished);
    const finishedPlans = plans.filter(p => p.isFinished);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Evolución de Cuotas</h2>

            {/* CHART */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-400">Proyección de Pagos Mensuales (Sumatoria)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `$${val / 1000}k`}
                            />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                itemStyle={{ color: '#f8fafc' }}
                                formatter={(val: number) => [`$${val.toLocaleString()}`, 'Total Cuotas']}
                            />
                            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>


            {/* ACTIVE PLANS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePlans.map(plan => (
                    <Card key={plan.id} className="bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-colors">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white">{plan.description}</h3>
                                    <p className="text-xs text-slate-500">{plan.category.name}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-mono font-bold text-blue-400">
                                        {plan.currency === 'USD' ? 'US$' : '$'}{plan.totalAmount.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-500">Total Plan</div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Progress Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Progreso ({plan.paidCount}/{plan.installmentsCount})</span>
                                    <span>{Math.round(plan.progress)}%</span>
                                </div>
                                <Progress value={plan.progress} className="h-2 bg-slate-900" indicatorClassName="bg-blue-600" />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-900 p-2 rounded">
                                    <span className="block text-slate-500">Pagado</span>
                                    <span className="font-bold text-emerald-400">${plan.paidAmount.toLocaleString()}</span>
                                </div>
                                <div className="bg-slate-900 p-2 rounded">
                                    <span className="block text-slate-500">Restante</span>
                                    <span className="font-bold text-red-400">${(plan.totalAmount - plan.paidAmount).toLocaleString()}</span>
                                </div>
                            </div>

                            {plan.nextDueDate && (
                                <div className="text-xs text-slate-500 pt-2 border-t border-slate-900 flex justify-between">
                                    <span>Próx. vencimiento:</span>
                                    <span className="text-white">{format(new Date(plan.nextDueDate), 'dd/MM/yyyy')}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {finishedPlans.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Finalizados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {finishedPlans.map(plan => (
                            <div key={plan.id} className="bg-slate-900/30 p-4 rounded border border-slate-900 opacity-70">
                                <h4 className="text-slate-400 font-bold">{plan.description}</h4>
                                <p className="text-xs text-emerald-600 font-medium mt-1">✓ Completado</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
