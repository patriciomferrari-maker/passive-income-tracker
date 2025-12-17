'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Search, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export function TransactionsTab() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);

    // Clone Month State
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [cloneData, setCloneData] = useState({
        sourceMonth: new Date().getMonth().toString(), // 0-11
        sourceYear: new Date().getFullYear().toString(),
        targetMonth: (new Date().getMonth() + 1).toString(), // Default next month
        targetYear: new Date().getFullYear().toString(),
    });

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        amount: '',
        currency: 'ARS',
        categoryId: '',
        subCategoryId: '',
        description: '',
        exchangeRate: '',
        status: 'REAL' // REAL, PROJECTED
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [txRes, catRes, rateRes] = await Promise.all([
                fetch('/api/barbosa/transactions'),
                fetch('/api/barbosa/categories'),
                fetch('/api/barbosa/exchange-rate')
            ]);

            setTransactions(await txRes.json());
            setCategories(await catRes.json());
            const rateData = await rateRes.json();

            // Store Exchange Rate if available, to be used in background calculation
            if (rateData.rate && !editingId) {
                setFormData(prev => ({
                    ...prev,
                    exchangeRate: prev.exchangeRate || rateData.rate.toString()
                }));
            }

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
                ? `/api/barbosa/transactions/${editingId}`
                : '/api/barbosa/transactions';

            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setFormData({
                    ...formData,
                    amount: '',
                    description: '',
                    categoryId: '', // Reset ID selection
                    subCategoryId: '' // Reset ID selection
                });
                setEditingId(null);
                loadData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async () => {
        if (!confirm(`¿Estás seguro de clonar los movimientos? Esto creará transacciones PROYECTADAS para el mes destino.`)) return;
        try {
            const res = await fetch('/api/barbosa/clone-month', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceMonth: parseInt(cloneData.sourceMonth) + 1, // 1-12
                    sourceYear: parseInt(cloneData.sourceYear),
                    targetMonth: parseInt(cloneData.targetMonth) + 1, // 1-12
                    targetYear: parseInt(cloneData.targetYear)
                })
            });
            const json = await res.json();
            if (res.ok) {
                alert(`Se clonaron ${json.count} movimientos correctamente.`);
                setCloneDialogOpen(false);
                loadData();
            } else {
                alert(`Error: ${json.message || json.error}`);
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        }
    };

    const handleEdit = (tx: any) => {
        setEditingId(tx.id);
        setFormData({
            date: new Date(tx.date).toISOString().split('T')[0],
            type: tx.type,
            amount: tx.amount.toString(),
            currency: tx.currency,
            categoryId: tx.categoryId,
            subCategoryId: tx.subCategoryId || '',
            description: tx.description || '',
            exchangeRate: tx.exchangeRate ? tx.exchangeRate.toString() : '',
            status: tx.status || 'REAL'
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;
        try {
            await fetch(`/api/barbosa/transactions/${id}`, { method: 'DELETE' });
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({
            ...formData,
            amount: '',
            description: '',
            categoryId: '',
            subCategoryId: ''
        });
    };

    // Derived: Current available categories based on type
    const uniqueCategories = categories.filter(c => c.type === formData.type);

    // Find selected category object to show subcategories
    const selectedCategoryObj = categories.find(c => c.id === formData.categoryId);
    const availableSubCategories = selectedCategoryObj ? selectedCategoryObj.subCategories : [];

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex justify-end bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                    {/* Clone Dialog Trigger */}
                    {!cloneDialogOpen ? (
                        <Button variant="outline" size="sm" onClick={() => setCloneDialogOpen(true)} className="border-slate-700 text-slate-300 hover:text-white">
                            <Calendar className="w-4 h-4 mr-2" /> Clonar Mes (Proyectar)
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 animate-in slide-in-from-right">
                            <span className="text-xs text-slate-400">Origen:</span>
                            <Select value={cloneData.sourceMonth} onValueChange={v => setCloneData({ ...cloneData, sourceMonth: v })}>
                                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{i + 1}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.sourceYear} onValueChange={v => setCloneData({ ...cloneData, sourceYear: v })}>
                                <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <span className="text-xs text-slate-400">-> Destino:</span>
                            <Select value={cloneData.targetMonth} onValueChange={v => setCloneData({ ...cloneData, targetMonth: v })}>
                                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{i + 1}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.targetYear} onValueChange={v => setCloneData({ ...cloneData, targetYear: v })}>
                                <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{['2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="sm" onClick={handleClone} className="h-8 bg-blue-600 hover:bg-blue-700 text-xs">Clonar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setCloneDialogOpen(false)} className="h-8 w-8 p-0 text-slate-500">X</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white">
                            {editingId ? 'Editar Transacción' : 'Nueva Transacción'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Status Selector */}
                            <div className="space-y-2">
                                <Label className="text-slate-300">Estado</Label>
                                <div className="flex gap-2">
                                    <div
                                        onClick={() => setFormData({ ...formData, status: 'REAL' })}
                                        className={`flex-1 p-2 rounded text-center text-xs font-bold cursor-pointer border ${formData.status === 'REAL' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                                    >
                                        REAL
                                    </div>
                                    <div
                                        onClick={() => setFormData({ ...formData, status: 'PROJECTED' })}
                                        className={`flex-1 p-2 rounded text-center text-xs font-bold cursor-pointer border ${formData.status === 'PROJECTED' ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                                    >
                                        PROYECTADO
                                    </div>
                                </div>
                            </div>

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
                                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
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
                                    onValueChange={v => {
                                        // Reset subcategory when category changes
                                        setFormData({ ...formData, categoryId: v, subCategoryId: '' });
                                    }}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {uniqueCategories.map((c: any) => (
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

                            <div className="flex gap-2">
                                {editingId && (
                                    <Button type="button" onClick={handleCancel} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                                        Cancelar
                                    </Button>
                                )}
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                                    <Save className="mr-2 h-4 w-4" /> {editingId ? 'Actualizar' : 'Guardar'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4">Últimos Movimientos</h3>

                    {transactions.reduce((groups: any[], tx) => {
                        const date = new Date(tx.date);
                        // Force UTC to avoid timezone shifts
                        const utcDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60000);
                        const key = format(utcDate, 'MMMM yyyy', { locale: undefined }); // Use default or Spanish locale if configured

                        const group = groups.find(g => g.key === key);
                        if (group) {
                            group.items.push({ ...tx, utcDate });
                        } else {
                            groups.push({ key, items: [{ ...tx, utcDate }] });
                        }
                        return groups;
                    }, []).map((group: any) => (
                        <div key={group.key} className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pl-1">{group.key}</h4>
                            <div className="border border-slate-800 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left text-slate-300">
                                    <thead className="bg-slate-900/50 text-slate-500 uppercase font-bold text-[10px]">
                                        <tr>
                                            <th className="px-4 py-2 w-[100px]">Fecha</th>
                                            <th className="px-4 py-2">Estado</th>
                                            <th className="px-4 py-2">Categoría</th>
                                            <th className="px-4 py-2">Desc</th>
                                            <th className="px-4 py-2 text-right">Monto</th>
                                            <th className="px-4 py-2 text-right w-[80px]">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 bg-slate-950">
                                        {group.items.map((tx: any) => (
                                            <tr key={tx.id} className={`hover:bg-slate-900/50 ${tx.status === 'PROJECTED' ? 'italic opacity-80' : ''}`}>
                                                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                                    {format(tx.utcDate, 'dd/MM/yyyy')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {tx.status === 'PROJECTED' ? (
                                                        <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800">PROY</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-emerald-900/50 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">REAL</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center">
                                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${tx.type === 'INCOME' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                        <span className="font-medium text-slate-300">{tx.category.name}</span>
                                                        {tx.subCategory && <span className="text-slate-500 ml-1 text-xs">({tx.subCategory.name})</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]">{tx.description}</td>
                                                <td className={`px-4 py-3 text-right font-mono font-medium ${tx.status === 'PROJECTED' ? 'text-purple-300' : 'text-white'}`}>
                                                    {tx.currency === 'USD' ? 'US$' : '$'} {tx.amount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                                                            onClick={() => handleEdit(tx)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                                            onClick={() => handleDelete(tx.id)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}

                    {transactions.length === 0 && (
                        <div className="border border-slate-800 rounded-lg p-8 text-center text-slate-500">
                            No hay movimientos registrados
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
