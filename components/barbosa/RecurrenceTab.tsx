
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Save, Trash2, Edit2, Play, Calendar } from 'lucide-react';

export function RecurrenceTab() {
    const [rules, setRules] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);

    // Form
    const [formData, setFormData] = useState({
        name: '',
        dayOfMonth: '1',
        type: 'EXPENSE',
        amount: '',
        currency: 'ARS',
        categoryId: '',
        subCategoryId: '',
        active: true
    });

    // Apply Props
    const [applyDialogOpen, setApplyDialogOpen] = useState(false);
    const [applyData, setApplyData] = useState({
        targetMonth: (new Date().getMonth() + 1).toString(),
        targetYear: new Date().getFullYear().toString()
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [rulesRes, catRes] = await Promise.all([
                fetch('/api/barbosa/recurrence'),
                fetch('/api/barbosa/categories')
            ]);
            setRules(await rulesRes.json());
            setCategories(await catRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingId
                ? `/api/barbosa/recurrence/${editingId}`
                : '/api/barbosa/recurrence';

            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                resetForm();
                loadData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleApply = async () => {
        if (!confirm(`¿Estás seguro de generar las transacciones recurrentes para el período seleccionado?`)) return;
        try {
            const res = await fetch('/api/barbosa/recurrence/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(applyData)
            });
            const json = await res.json();
            if (res.ok) {
                alert(`Se generaron ${json.count} proyecciones.`);
                setApplyDialogOpen(false);
            } else {
                alert(`Error: ${json.message || json.error}`);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta regla?')) return;
        await fetch(`/api/barbosa/recurrence/${id}`, { method: 'DELETE' });
        loadData();
    };

    const handleEdit = (rule: any) => {
        setEditingId(rule.id);
        setFormData({
            name: rule.name,
            dayOfMonth: rule.dayOfMonth.toString(),
            type: rule.type,
            amount: rule.amount.toString(),
            currency: rule.currency,
            categoryId: rule.categoryId,
            subCategoryId: rule.subCategoryId || '',
            active: rule.active
        });
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            name: '',
            dayOfMonth: '1',
            type: 'EXPENSE',
            amount: '',
            currency: 'ARS',
            categoryId: '',
            subCategoryId: '',
            active: true
        });
    };

    // Derived
    const uniqueCategories = categories.filter(c => c.type === formData.type);
    const selectedCategoryObj = categories.find(c => c.id === formData.categoryId);
    const availableSubCategories = selectedCategoryObj ? selectedCategoryObj.subCategories : [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div className="text-white">
                    <h2 className="text-xl font-bold">Reglas Recurrentes</h2>
                    <p className="text-slate-400 text-sm">Automatiza gastos fijos (Alquiler, Expensas, Servicios)</p>
                </div>

                {/* Apply Toolbar */}
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700">
                    <span className="text-xs text-slate-400 font-bold uppercase mr-2">Proyección Automática</span>
                    <Select value={applyData.targetMonth} onValueChange={v => setApplyData({ ...applyData, targetMonth: v })}>
                        <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-950"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={(i + 1).toString()}>{i + 1}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={applyData.targetYear} onValueChange={v => setApplyData({ ...applyData, targetYear: v })}>
                        <SelectTrigger className="w-[80px] h-8 text-xs bg-slate-950"><SelectValue /></SelectTrigger>
                        <SelectContent>{['2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleApply} className="h-8 bg-purple-600 hover:bg-purple-700 text-xs">
                        <Play className="w-3 h-3 mr-2" /> Ejecutar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white text-base">{editingId ? 'Editar Regla' : 'Nueva Regla'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Nombre del Gasto</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-slate-950 border-slate-700 text-white" placeholder="Ej: Expensas, Internet" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Día del Mes</Label>
                                    <Select value={formData.dayOfMonth} onValueChange={v => setFormData({ ...formData, dayOfMonth: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                            {Array.from({ length: 31 }).map((_, i) => (
                                                <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Monto</Label>
                                    <Input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="bg-slate-950 border-slate-700 text-white" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Moneda</Label>
                                    <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ARS">ARS</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Tipo</Label>
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Categoría</Label>
                                <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v, subCategoryId: '' })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent>
                                        {uniqueCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Sub Categoría</Label>
                                <Select value={formData.subCategoryId} onValueChange={v => setFormData({ ...formData, subCategoryId: v })} disabled={!availableSubCategories.length}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white disabled:opacity-50"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent>
                                        {availableSubCategories.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {editingId && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-sm text-slate-300">Activo</span>
                                    <Switch checked={formData.active} onCheckedChange={c => setFormData({ ...formData, active: c })} />
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                {editingId && <Button type="button" onClick={resetForm} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300">Cancelar</Button>}
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">{editingId ? 'Actualizar' : 'Crear Regla'}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    {rules.length === 0 ? (
                        <div className="border border-slate-800 rounded-lg p-12 text-center text-slate-500 bg-slate-900/20">
                            No tenés reglas creadas. Creá la primera para automatizar tus gastos.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rules.map(rule => (
                                <div key={rule.id} className={`p-4 rounded-lg border ${rule.active ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 opacity-60'} relative group transition-all hover:border-slate-700`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-white font-bold">{rule.name}</h3>
                                                {!rule.active && <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">PAUSADO</span>}
                                            </div>
                                            <p className="text-slate-400 text-xs">Día {rule.dayOfMonth} de cada mes</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-emerald-400 font-mono font-bold">
                                                {rule.currency === 'USD' ? 'US$' : '$'}{rule.amount.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-slate-500 uppercase">{rule.category.name}</div>
                                        </div>
                                    </div>

                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 rounded p-1 flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-blue-400" onClick={() => handleEdit(rule)}><Edit2 className="w-3 h-3" /></Button>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-red-400" onClick={() => handleDelete(rule.id)}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
