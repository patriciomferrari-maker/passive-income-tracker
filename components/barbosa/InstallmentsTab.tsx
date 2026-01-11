'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { Loader2, Edit, Trash2 } from 'lucide-react';
import { InstallmentsEvolutionTable } from './InstallmentsEvolutionTable';
// import { EditInstallmentDialog } from './EditInstallmentDialog';
import { InstallmentsDialog } from './InstallmentsDialog';

export function InstallmentsTab() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // SHOW ALL BY DEFAULT (Requested by user)
    const [showFinished, setShowFinished] = useState(true);
    const [categories, setCategories] = useState<any[]>([]);

    // Edit Dialog State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editPlanId, setEditPlanId] = useState<string | null>(null);
    const [editPlanData, setEditPlanData] = useState<any | null>(null);
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

    useEffect(() => {
        loadData();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/barbosa/categories');
            const data = await res.json();
            setCategories(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const loadData = async () => {
        try {
            const res = await fetch('/api/barbosa/installments');
            const data = await res.json();
            setPlans(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (plan: any) => {
        setEditPlanId(plan.id);
        setEditPlanData({
            description: plan.description,
            categoryId: plan.categoryId,
            subCategoryId: plan.subCategoryId || '',
            currency: plan.currency,
            startDate: new Date(plan.startDate).toISOString().split('T')[0],
            installmentsCount: plan.installmentsCount.toString(),
            amountMode: 'TOTAL', // Default to TOTAL when editing existing, logic can be smarter but this is safe
            amountValue: plan.totalAmount.toString(),
            status: 'REAL', // Default
            isStatistical: plan.isStatistical
        });
        setDialogOpen(true);
    };

    const handleBatchDelete = async () => {
        if (selectedPlanIds.length === 0) return;
        if (!confirm(`¿Eliminar ${selectedPlanIds.length} planes seleccionados y todas sus cuotas?`)) return;

        setLoading(true);
        try {
            await Promise.all(selectedPlanIds.map(id =>
                fetch(`/api/barbosa/transactions/installments/${id}`, { method: 'DELETE' })
            ));
            setSelectedPlanIds([]);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar los planes seleccionados");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedPlanIds(filteredPlans.map(p => p.id));
        } else {
            setSelectedPlanIds([]);
        }
    };

    const toggleSelectPlan = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedPlanIds(prev => [...prev, id]);
        } else {
            setSelectedPlanIds(prev => prev.filter(pid => pid !== id));
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" /></div>;

    const filteredPlans = plans.filter(p => showFinished ? true : !p.isFinished);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* 1. Evolution Table */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">Evolución y Detalle</h2>
                <InstallmentsEvolutionTable />
            </div>

            {/* 2. Unified Installments Table */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Cuotas Cargadas</h2>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (filteredPlans.length > 0 && selectedPlanIds.length === filteredPlans.length) {
                                    setSelectedPlanIds([]);
                                } else {
                                    setSelectedPlanIds(filteredPlans.map(p => p.id));
                                }
                            }}
                            className="h-8 text-[10px] uppercase font-bold text-slate-400 border-slate-800 hover:bg-slate-800"
                        >
                            {filteredPlans.length > 0 && selectedPlanIds.length === filteredPlans.length ? 'Deseleccionar' : 'Seleccionar Todo'}
                        </Button>

                        {selectedPlanIds.length > 0 && (
                            <button
                                onClick={handleBatchDelete}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-950/30 border border-red-900/50 text-red-400 hover:bg-red-900/40 rounded-lg text-xs font-bold transition-all animate-in fade-in zoom-in h-8"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Borrar ({selectedPlanIds.length})
                            </button>
                        )}

                        <div className="flex items-center space-x-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                            <Checkbox
                                id="showFinished"
                                checked={showFinished}
                                onCheckedChange={(checked) => {
                                    setShowFinished(checked === true);
                                    setSelectedPlanIds([]); // Clear selection when filter changes
                                }}
                                className="data-[state=checked]:bg-blue-600 border-slate-600"
                            />
                            <label
                                htmlFor="showFinished"
                                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300 cursor-pointer"
                            >
                                Mostrar Finalizadas
                            </label>
                        </div>
                    </div>
                </div>

                <div className="rounded-md border border-slate-800 bg-slate-950/50 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-900">
                            <TableRow className="hover:bg-slate-900 border-slate-800">
                                <TableHead className="w-[40px] text-center">
                                    <Checkbox
                                        checked={filteredPlans.length > 0 && selectedPlanIds.length === filteredPlans.length}
                                        onCheckedChange={toggleSelectAll}
                                        className="border-slate-600 data-[state=checked]:bg-blue-600"
                                    />
                                </TableHead>
                                <TableHead className="text-slate-400 font-bold min-w-[200px]">Concepto</TableHead>
                                <TableHead className="text-slate-400 font-bold">Categoría</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Progreso</TableHead>
                                <TableHead className="text-slate-400 font-bold text-right">Monto Total</TableHead>
                                <TableHead className="text-slate-400 font-bold text-right">Restante</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Próx. Venc.</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Estado</TableHead>
                                <TableHead className="text-slate-400 font-bold text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPlans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                        No hay planes para mostrar
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPlans.map((plan) => (
                                    <TableRow
                                        key={plan.id}
                                        className={`border-slate-800 hover:bg-slate-900/40 transition-colors ${plan.isFinished ? 'opacity-50 hover:opacity-100 bg-slate-900/20' : ''}`}
                                    >
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={selectedPlanIds.includes(plan.id)}
                                                onCheckedChange={(checked) => toggleSelectPlan(plan.id, checked === true)}
                                                className="border-slate-700 data-[state=checked]:bg-blue-600"
                                            />
                                        </TableCell>
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
                                                <Progress
                                                    value={plan.progress}
                                                    className="h-1.5 w-full bg-slate-900"
                                                    indicatorClassName={plan.isFinished ? "bg-emerald-600" : "bg-blue-600"}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-slate-300">
                                            {plan.currency === 'USD' ? 'US$' : '$'}{plan.totalAmount.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-red-400">
                                            {plan.isFinished ? '-' : `$${(plan.totalAmount - plan.paidAmount).toLocaleString()}`}
                                        </TableCell>
                                        <TableCell className="text-center text-slate-400 text-xs">
                                            {plan.nextDueDate && !plan.isFinished ? format(new Date(plan.nextDueDate), 'dd/MM/yy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {plan.isFinished ? (
                                                <Badge className="bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900/50 border-emerald-900" variant="secondary">Finalizado</Badge>
                                            ) : (
                                                <Badge className="bg-blue-900/50 text-blue-400 hover:bg-blue-900/50 border-blue-900" variant="secondary">Activo</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(plan)}
                                                    className="text-slate-500 hover:text-white transition-colors"
                                                    title="Editar Plan"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(plan.id, plan.description)} className="text-slate-500 hover:text-red-500 transition-colors" title="Eliminar Plan">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <InstallmentsDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={loadData}
                categories={categories}
                editId={editPlanId}
                initialData={editPlanData}
            />
        </div >
    );
}
