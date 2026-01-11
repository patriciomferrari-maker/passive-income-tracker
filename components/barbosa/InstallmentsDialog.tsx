'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InstallmentsDialog({ open, onOpenChange, onSuccess, categories, editId = null, initialData = null }: any) {
    const [loading, setLoading] = useState(false);

    const defaultData = {
        description: '',
        categoryId: '',
        subCategoryId: '',
        currency: 'ARS',
        startDate: new Date().toISOString().split('T')[0],
        installmentsCount: '12',
        amountMode: 'TOTAL', // TOTAL | INSTALLMENT
        amountValue: '',
        status: 'PROJECTED',
        isStatistical: false,
        comprobante: ''
    };

    const [data, setData] = useState(defaultData);

    useEffect(() => {
        if (open && initialData) {
            setData(initialData);
        } else if (open && !initialData) {
            setData(defaultData);
        }
    }, [open, initialData]);

    // Helper for derived state
    const count = parseInt(data.installmentsCount) || 1;
    const value = parseFloat(data.amountValue) || 0;
    const amountPerQuota = data.amountMode === 'TOTAL' ? value / count : value;
    const totalAmount = data.amountMode === 'TOTAL' ? value : value * count;

    const uniqueCategories = categories.filter((c: any) => c.type === 'EXPENSE');
    const selectedCategoryObj = categories.find((c: any) => c.id === data.categoryId);
    const availableSubCategories = selectedCategoryObj ? selectedCategoryObj.subCategories : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = editId
                ? `/api/barbosa/transactions/installments/${editId}`
                : '/api/barbosa/transactions/installments';

            const method = editId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                onSuccess();
                onOpenChange(false);
                // Reset handled by useEffect
            } else {
                alert('Error al guardar cuotas');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editId ? 'Editar Plan de Cuotas' : 'Cargar en Cuotas'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label>Descripción (Ej: TV Samsung)</Label>
                        <Input value={data.description} onChange={e => setData({ ...data, description: e.target.value })} className="bg-slate-950 border-slate-700" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={data.categoryId} onValueChange={v => setData({ ...data, categoryId: v, subCategoryId: '' })}>
                                <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                    {uniqueCategories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Sub Categoría</Label>
                            <Select value={data.subCategoryId} onValueChange={v => setData({ ...data, subCategoryId: v })} disabled={!availableSubCategories.length}>
                                <SelectTrigger className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue placeholder="..." /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                    {availableSubCategories.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Inicio (1ra Cuota)</Label>
                            <Input type="date" value={data.startDate} onChange={e => setData({ ...data, startDate: e.target.value })} className="bg-slate-950 border-slate-700" required />
                        </div>
                        <div className="space-y-2">
                            <Label>Cant. Cuotas</Label>
                            <Input type="number" min="2" max="120" value={data.installmentsCount} onChange={e => setData({ ...data, installmentsCount: e.target.value })} className="bg-slate-950 border-slate-700" required />
                        </div>
                    </div>

                    <div className="bg-slate-950/50 p-3 rounded border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-400">MODO DE CARGA</Label>
                            <div className="flex bg-slate-900 rounded p-1 border border-slate-800">
                                <button type="button" onClick={() => setData({ ...data, amountMode: 'TOTAL' })} className={`text-[10px] px-2 py-1 rounded ${data.amountMode === 'TOTAL' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>TOTAL</button>
                                <button type="button" onClick={() => setData({ ...data, amountMode: 'INSTALLMENT' })} className={`text-[10px] px-2 py-1 rounded ${data.amountMode === 'INSTALLMENT' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>POR CUOTA</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-xs">Moneda</Label>
                                <Select value={data.currency} onValueChange={v => setData({ ...data, currency: v })}>
                                    <SelectTrigger className="bg-slate-900 border-slate-700 h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ARS">ARS</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">{data.amountMode === 'TOTAL' ? 'Monto TOTAL' : 'Monto CUOTA'}</Label>
                                <Input type="number" value={data.amountValue} onChange={e => setData({ ...data, amountValue: e.target.value })} className="bg-slate-900 border-slate-700 h-8 text-xs" required />
                            </div>
                        </div>

                        <div className="text-xs text-center pt-1 text-slate-300">
                            {data.amountMode === 'TOTAL' ? (
                                <span>~ ${amountPerQuota.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / cuota</span>
                            ) : (
                                <span>Total: ${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            Comprobante / Voucher
                            <span className="text-[10px] text-slate-500 font-normal">(Opcional para detectar duplicados)</span>
                        </Label>
                        <Input
                            value={data.comprobante}
                            onChange={e => setData({ ...data, comprobante: e.target.value })}
                            className="bg-slate-950 border-slate-700 h-8 text-xs font-mono"
                            placeholder="Ej: 001234"
                        />
                    </div>

                    <div className="flex items-center justify-between hidden">
                        <Label>Estado Cuotas</Label>
                        <Select value={data.status} onValueChange={v => setData({ ...data, status: v })}>
                            <SelectTrigger className="w-[140px] bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PROJECTED">Proyectado (A futuro)</SelectItem>
                                <SelectItem value="REAL">Real (Confirmado)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-800">
                        <input
                            type="checkbox"
                            id="isStatisticalInstallment"
                            checked={data.isStatistical}
                            onChange={e => setData({ ...data, isStatistical: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                        />
                        <label htmlFor="isStatisticalInstallment" className="text-sm font-medium leading-none text-slate-400 cursor-pointer">
                            Pagado con Tarjeta (Estadístico)
                            <span className="block text-[10px] text-slate-500 font-normal mt-0.5">No suma al total de gastos (Evita duplicados)</span>
                        </label>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                        {loading ? 'Guardando...' : (editId ? 'Guardar Cambios' : 'Generar Cuotas')}
                    </Button>
                </form>
            </DialogContent>
        </Dialog >
    );
}
