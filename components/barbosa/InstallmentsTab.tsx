'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { Loader2, Edit } from 'lucide-react';
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

            {/* 2. Active Plans Management (Table View) */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Gestión de Planes Activos</h2>
                </div>

                <div className="rounded-md border border-slate-800 bg-slate-950/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-900">
                            <TableRow className="hover:bg-slate-900 border-slate-800">
                                <TableHead className="text-slate-400 font-bold min-w-[200px]">Concepto</TableHead>
                                <TableHead className="text-slate-400 font-bold">Categoría</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Progreso</TableHead>
                                <TableHead className="text-slate-400 font-bold text-right">Monto Total</TableHead>
                                <TableHead className="text-slate-400 font-bold text-right">Restante</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Próx. Venc.</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activePlans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                        No hay planes activos
                                    </TableCell>
                                </TableRow>
                            ) : (
                                activePlans.map((plan) => (
                                    <TableRow key={plan.id} className="border-slate-800 hover:bg-slate-900/40 transition-colors">
                                        <TableCell className="font-medium text-white">
                                            {plan.description}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className="w-fit text-[10px] border-slate-700 text-slate-400">
                                                    {plan.category.name}
                                                </Badge>
                                                {plan.subCategory && (
                                                    <span className="text-xs text-slate-600">{plan.subCategory.name}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1 w-[120px] mx-auto">
                                                <span className="text-xs text-slate-400">
                                                    {plan.paidCount} / {plan.installmentsCount}
                                                </span>
                                                <Progress value={plan.progress} className="h-1.5 w-full bg-slate-900" indicatorClassName="bg-blue-600" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-slate-300">
                                            {plan.currency === 'USD' ? 'US$' : '$'}{plan.totalAmount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-red-400">
                                            ${(plan.totalAmount - plan.paidAmount).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center text-slate-400 text-xs">
                                            {plan.nextDueDate ? format(new Date(plan.nextDueDate), 'dd/MM/yy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <EditInstallmentDialog plan={plan} onSuccess={loadData} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
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
