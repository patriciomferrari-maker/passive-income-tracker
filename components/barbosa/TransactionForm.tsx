
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from 'lucide-react';

interface TransactionFormProps {
    initialData?: any;
    categories: any[];
    onClose: () => void;
    onSaved: () => void;
}

export function TransactionForm({ initialData, categories, onClose, onSaved }: TransactionFormProps) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        amount: '',
        currency: 'ARS',
        categoryId: '',
        subCategoryId: '',
        description: '',
        exchangeRate: '',
        status: 'REAL',
        isStatistical: false,
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: new Date(initialData.date).toISOString().split('T')[0],
                type: initialData.type || 'EXPENSE',
                amount: initialData.amount?.toString() || '',
                currency: initialData.currency || 'ARS',
                categoryId: initialData.categoryId || '',
                subCategoryId: initialData.subCategoryId || '',
                description: initialData.description || '',
                exchangeRate: initialData.exchangeRate?.toString() || '',
                status: initialData.status || 'REAL',
                isStatistical: initialData.isStatistical || false,
            });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = initialData
                ? `/api/barbosa/transactions/${initialData.id}`
                : '/api/barbosa/transactions';

            const method = initialData ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                onSaved();
            } else {
                alert('Error al guardar');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    // Filter categories by type
    const availableCategories = categories.filter(c => c.type === formData.type);
    // Filter subcategories by selected category
    const selectedCategory = categories.find(c => c.id === formData.categoryId);
    const availableSubCategories = selectedCategory?.subCategories || [];

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-300">Fecha</Label>
                    <Input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="bg-slate-950 border-slate-700 text-white"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-300">Tipo</Label>
                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v, categoryId: '', subCategoryId: '' })}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                            <SelectItem value="INCOME">Ingreso</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Statistical Checkbox */}
            {formData.type === 'EXPENSE' && (
                <div className="flex items-center space-x-2 pt-2">
                    <input
                        type="checkbox"
                        id="isStatisticalForm"
                        checked={formData.isStatistical}
                        onChange={e => setFormData({ ...formData, isStatistical: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="isStatisticalForm" className="text-sm font-medium leading-none text-slate-400 cursor-pointer">
                        Pagado con Tarjeta (Estadístico)
                        <span className="block text-[10px] text-slate-500 font-normal mt-0.5">No suma al total de gastos (Evita duplicados)</span>
                    </label>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-300">Monto</Label>
                    <div className="relative">
                        <span className="absolute left-2 top-2.5 text-slate-500">$</span>
                        <Input
                            type="number" step="0.01"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            className="bg-slate-950 border-slate-700 text-white pl-6"
                            required
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-300">Moneda</Label>
                    <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="ARS">ARS</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-slate-300">Categoría</Label>
                <Select
                    value={formData.categoryId}
                    onValueChange={v => setFormData({ ...formData, categoryId: v, subCategoryId: '' })}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                        <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {availableCategories.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-slate-300">Sub Categoría</Label>
                <Select
                    value={formData.subCategoryId}
                    onValueChange={v => setFormData({ ...formData, subCategoryId: v })}
                    disabled={!availableSubCategories.length}
                >
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white disabled:opacity-50">
                        <SelectValue placeholder={availableSubCategories.length ? "Seleccionar..." : "N/A"} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {availableSubCategories.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-slate-300">Descripción</Label>
                <Input
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-white"
                />
            </div>

            <div className="flex gap-2 pt-2">
                <Button type="button" onClick={onClose} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                    Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    <Save className="mr-2 h-4 w-4" /> {initialData ? 'Actualizar' : 'Guardar'}
                </Button>
            </div>
        </form>
    );
}
