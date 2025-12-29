'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Edit } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    subCategories: { id: string, name: string }[];
}

interface EditInstallmentDialogProps {
    plan: any;
    onSuccess: () => void;
}

export function EditInstallmentDialog({ plan, onSuccess }: EditInstallmentDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        totalAmount: '',
        installmentsCount: '',
        startDate: '',
        categoryId: '',
        subCategoryId: ''
    });

    useEffect(() => {
        if (open) {
            // Initialize form with plan data
            setFormData({
                description: plan.description,
                totalAmount: plan.totalAmount.toString(),
                installmentsCount: plan.installmentsCount.toString(),
                startDate: new Date(plan.startDate).toISOString().split('T')[0],
                categoryId: plan.categoryId,
                subCategoryId: plan.subCategoryId || ''
            });

            // Fetch categories for the select
            fetch('/api/barbosa/categories')
                .then(res => res.json())
                .then(data => setCategories(data));
        }
    }, [open, plan]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/barbosa/installments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: plan.id,
                    ...formData
                })
            });

            if (!res.ok) throw new Error('Failed to update');

            setOpen(false);
            onSuccess();
        } catch (error) {
            console.error(error);
            alert('Error updating plan');
        } finally {
            setLoading(false);
        }
    };

    const selectedCategory = categories.find(c => c.id === formData.categoryId);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
                    <Edit className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-950 border-slate-900 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Plan de Cuotas</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="bg-slate-900 border-slate-800"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="amount">Monto Total</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={formData.totalAmount}
                                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                                className="bg-slate-900 border-slate-800"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="count">Cant. Cuotas</Label>
                            <Input
                                id="count"
                                type="number"
                                value={formData.installmentsCount}
                                onChange={(e) => setFormData({ ...formData, installmentsCount: e.target.value })}
                                className="bg-slate-900 border-slate-800"
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="date">Fecha Inicio</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            className="bg-slate-900 border-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Categoría</Label>
                            <Select
                                value={formData.categoryId}
                                onValueChange={(val) => setFormData({ ...formData, categoryId: val, subCategoryId: '' })}
                            >
                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800">
                                    {categories.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Subcategoría</Label>
                            <Select
                                value={formData.subCategoryId}
                                onValueChange={(val) => setFormData({ ...formData, subCategoryId: val })}
                                disabled={!selectedCategory || selectedCategory.subCategories.length === 0}
                            >
                                <SelectTrigger className="bg-slate-900 border-slate-800">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800">
                                    {selectedCategory?.subCategories.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar Cambios'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
