'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Loader2, Table } from 'lucide-react';
import { InstallmentsEvolutionTable } from './InstallmentsEvolutionTable';
import { EditInstallmentDialog } from './EditInstallmentDialog';

export function InstallmentsTab() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await fetch('/api/barbosa/installments');
            const data = await res.json();
            setPlans(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;

    const activePlans = plans.filter(p => !p.isFinished);
    const finishedPlans = plans.filter(p => p.isFinished);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* 1. Evolution Table (The requested "Cuadro Detalle") */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">Evolución y Detalle</h2>
                <InstallmentsEvolutionTable />
            </div>

            {/* 2. Active Plans Management */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
                <h2 className="text-xl font-bold text-white mb-4">Gestión de Planes Activos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activePlans.map(plan => (
                        <Card key={plan.id} className="bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-colors">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="overflow-hidden">
                                        <h3 className="font-bold text-white truncate text-sm">{plan.description}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{plan.category.name}</Badge>
                                            {plan.subCategory && <span className="text-xs text-slate-600">{plan.subCategory.name}</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 ml-4">
                                        <EditInstallmentDialog plan={plan} onSuccess={loadData} />
                                        <div className="text-right whitespace-nowrap">
                                            <div className="text-sm font-mono font-bold text-blue-400">
                                                {plan.currency === 'USD' ? 'US$' : '$'}{plan.totalAmount.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Progress Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>{plan.paidCount} de {plan.installmentsCount} cuotas</span>
                                        <span>{Math.round(plan.progress)}%</span>
                                    </div>
                                    <Progress value={plan.progress} className="h-1.5 bg-slate-900" indicatorClassName="bg-blue-600" />
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-900/50 p-2 rounded border border-slate-900/50">
                                        <span className="block text-slate-500 mb-1">Restante</span>
                                        <span className="font-bold text-red-400 text-sm">${(plan.totalAmount - plan.paidAmount).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2 rounded border border-slate-900/50 flex flex-col justify-center">
                                        {plan.nextDueDate && (
                                            <>
                                                <span className="block text-slate-500 mb-1">Próx. Venc.</span>
                                                <span className="text-slate-300 font-bold">
                                                    {format(new Date(plan.nextDueDate), 'dd/MM/yy')}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* 3. Finished Plans */}
            {finishedPlans.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-900">
                    <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Historial Finalizados</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {finishedPlans.map(plan => (
                            <div key={plan.id} className="bg-slate-900/30 p-3 rounded-lg border border-slate-900 opacity-60 hover:opacity-100 transition-opacity">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-slate-400 font-bold text-sm truncate">{plan.description}</h4>
                                    <EditInstallmentDialog plan={plan} onSuccess={loadData} />
                                </div>
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
