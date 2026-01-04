'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Save, Search, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export function TransactionsTab() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);

    // Clone Month State
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
    const [installmentsDialogOpen, setInstallmentsDialogOpen] = useState(false); // NEW State

    const [cloneData, setCloneData] = useState({
        sourceMonth: new Date().getMonth().toString(), // 0-11
        sourceYear: new Date().getFullYear().toString(),
        targetMonth: (new Date().getMonth() + 1).toString(), // Default next month
        targetYear: new Date().getFullYear().toString(),
    });

    const [filterStatistical, setFilterStatistical] = useState(false);
    const [filterMonth, setFilterMonth] = useState('ALL'); // 'ALL' or '0'-'11'
    const [filterYear, setFilterYear] = useState('ALL'); // Default ALL years

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        amount: '',
        currency: 'ARS',
        categoryId: '',
        subCategoryId: '',
        description: '',
        exchangeRate: '',
        status: 'REAL', // REAL, PROJECTED
        isStatistical: false,
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

    const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
    const [selectedTxForChoice, setSelectedTxForChoice] = useState<any>(null);

    const handleEdit = (tx: any) => {
        if (tx.installmentsPlanId) {
            setSelectedTxForChoice(tx);
            setChoiceDialogOpen(true);
            return;
        }
        startEditingTransaction(tx);
    };

    const startEditingTransaction = (tx: any) => {
        try {
            setEditingId(tx.id);
            const safeDate = new Date(tx.date);
            const dateStr = !isNaN(safeDate.getTime()) ? safeDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            setFormData({
                date: dateStr,
                type: tx.type,
                amount: tx.amount.toString(),
                currency: tx.currency,
                categoryId: tx.categoryId || '',
                subCategoryId: tx.subCategoryId || '',
                description: tx.description || '',
                exchangeRate: tx.exchangeRate ? tx.exchangeRate.toString() : '',
                status: tx.status || 'REAL',
                isStatistical: tx.isStatistical || false
            });
        } catch (e) {
            console.error("Error setting up edit form", e);
        }
    };

    // Plan Editing State
    const [planEditId, setPlanEditId] = useState<string | null>(null);
    const [planInitialData, setPlanInitialData] = useState<any>(null);

    const handleEditPlan = async () => {
        if (!selectedTxForChoice?.installmentsPlanId) return;

        try {
            const planId = selectedTxForChoice.installmentsPlanId;
            const res = await fetch(`/api/barbosa/transactions/installments/${planId}`);
            if (res.ok) {
                const plan = await res.json();

                // Transform data for form
                setPlanInitialData({
                    description: plan.description,
                    categoryId: plan.categoryId,
                    subCategoryId: plan.subCategoryId || '',
                    currency: plan.currency,
                    startDate: new Date(plan.startDate).toISOString().split('T')[0],
                    installmentsCount: plan.installmentsCount.toString(),
                    amountMode: 'TOTAL', // Default to showing TOTAL for editing
                    amountValue: plan.totalAmount.toString(),
                    status: 'PROJECTED', // Default, though we might want to fetch stats
                    isStatistical: plan.isStatistical
                });
                setPlanEditId(planId);
                setInstallmentsDialogOpen(true);
                setChoiceDialogOpen(false);
            } else {
                alert('Error al obtener datos del plan');
            }
        } catch (e) {
            console.error(e);
            alert('Error al obtener datos del plan');
        }
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

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`¿Eliminar ${selectedIds.size} elementos seleccionados?`)) return;

        try {
            await fetch('/api/barbosa/transactions/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });
            setSelectedIds(new Set());
            loadData();
        } catch (error) {
            console.error(error);
            alert('Error eliminando');
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-800 gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setInstallmentsDialogOpen(true)} className="border-slate-700 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800">
                        <span className="mr-2 text-xs font-bold">💳</span> Cuotas
                    </Button>

                    {/* Filters Group */}
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                        <span className="text-xs text-slate-500 font-bold uppercase mr-2">Filtros:</span>

                        {/* Month Filter */}
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                            <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                <SelectItem value="ALL">Todo Año</SelectItem>
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Year Filter */}
                        <Select value={filterYear} onValueChange={setFilterYear}>
                            <SelectTrigger className="w-auto min-w-[100px] h-8 text-xs bg-slate-900 border-slate-700 text-slate-300">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 z-50">
                                <SelectItem value="ALL">Histórico</SelectItem>
                                {['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {/* Statistical Toggle */}
                        <div className={`cursor-pointer h-8 px-3 rounded flex items-center justify-center border transition-all select-none ${filterStatistical
                            ? 'bg-blue-900/30 border-blue-600 text-blue-400'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                            onClick={() => setFilterStatistical(!filterStatistical)}
                            title="Ver solo movimientos estadísticos"
                        >
                            <span className="text-[10px] font-bold">ESTAD.</span>
                        </div>
                    </div>

                    {/* Batch Actions */}
                </div>

                <div className="flex items-center gap-2">
                    {/* Batch Actions (Moved to right) */}
                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBatchDelete}
                            className="h-8 text-xs animate-in fade-in zoom-in mr-2"
                        >
                            Eliminar ({selectedIds.size})
                        </Button>
                    )}
                    {/* Clone Dialog Trigger */}
                    {/* Clone Dialog Trigger */}
                    {!cloneDialogOpen ? (
                        <Button variant="outline" size="sm" onClick={() => setCloneDialogOpen(true)} className="border-slate-700 text-slate-300 hover:text-white whitespace-nowrap">
                            <Calendar className="w-4 h-4 mr-2" /> Clonar Mes
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 animate-in slide-in-from-right">
                            {/* ... existing clone dialog content ... */}
                            <span className="text-xs font-bold text-slate-300">Origen:</span>
                            <Select value={cloneData.sourceMonth} onValueChange={v => setCloneData({ ...cloneData, sourceMonth: v })}>
                                <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.sourceYear} onValueChange={v => setCloneData({ ...cloneData, sourceYear: v })}>
                                <SelectTrigger className="w-[70px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{['2024', '2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <span className="text-xs font-bold text-slate-300 mx-1">→</span>
                            <Select value={cloneData.targetMonth} onValueChange={v => setCloneData({ ...cloneData, targetMonth: v })}>
                                <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i} value={i.toString()}>{format(new Date(2024, i, 1), 'MMMM')}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={cloneData.targetYear} onValueChange={v => setCloneData({ ...cloneData, targetYear: v })}>
                                <SelectTrigger className="w-[70px] h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">{['2025', '2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="sm" onClick={handleClone} className="h-8 bg-blue-600 hover:bg-blue-700 text-xs ml-2 text-white px-2">OK</Button>
                            <Button size="sm" variant="ghost" onClick={() => setCloneDialogOpen(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">X</Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Form */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white">
                            Nueva Transacción
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

                            {/* Status Selector REMOVED - Defaulting to REAL internally */}
                            <div className="space-y-2">
                                {/* Statistical Expense Checkbox */}
                                {formData.type === 'EXPENSE' && (
                                    <div className="flex items-center space-x-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="isStatistical"
                                            checked={formData.isStatistical}
                                            onChange={e => setFormData({ ...formData, isStatistical: e.target.checked })}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                                        />
                                        <label htmlFor="isStatistical" className="text-sm font-medium leading-none text-slate-400 cursor-pointer">
                                            Pagado con Tarjeta (Estadístico)
                                            <span className="block text-[10px] text-slate-500 font-normal mt-0.5">No suma al total de gastos (Evita duplicados)</span>
                                        </label>
                                    </div>
                                )}
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

                {/* Edit Modal */}
                <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Editar Transacción</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                            {/* ... Reusing form fields structure or extracting component ... */}
                            {/* For simplicity/speed, I'm duplicating or rendering a sub-component. 
                                 Since standard refactor is risky without seeing full file, I will extract fields to a helper if I could, 
                                 but here I will just render the form inside safely. 
                                 
                                 Actually, `formData` is shared. If I edit `formData` it updates the "New" form too if I'm not careful.
                                 But current logic uses `formData` for both.
                                 If I open modal, the "New" form will also show the values?
                                 Yes, `formData` is state.
                                 
                                 Wait, if `editingId` is set, the "New Transaction" card shows "Editar Transaccion" title (line 276).
                                 I should CHANGE the "New Transaction" card to ALWAYS act as "New", and use a separate state/modal for Editing.
                                 
                                 BUT, `handleEdit` sets `formData`.
                                 To avoid massive refactor of state, I will keep `formData` strictly for the active operation.
                                 If `editingId` is active, the "New" card might look weird if it mirrors the state?
                                 Actually, I should hide the "New" card or reset it?
                                 
                                 BETTER APPROACH:
                                 Keep `formData` for the Modal if `editingId` is present.
                                 Use a SEPARATE `newFormData` for the inline form?
                                 
                                 OR, just use the Modal for Editing, and clear `formData` when closing.
                                 The "New Transaction" card will display the current `formData` (which is being edited).
                                 That's fine, effectively the user is working on that data.
                                 
                                 User said: "que te aparezca el cuadro... en la mitad de la pantalla".
                                 So I will wrap the form in a Dialog ONLY if editingId is set.
                                 And the "Inline" card will be "New Transaction" and maybe Disabled or Clear?
                                 
                                 Actually, if I render the Dialog, I can just render the inputs there.
                                 The user won't see the inline form if the modal is covering it.
                                 
                                 Let's duplicate the inputs into the Dialog for now to control layout better, 
                                 or render a standard <TransactionForm /> component?
                                 I'll duplicate for reliability in this context, or Extract.
                                 
                                 Duplicating is safest to ensure exact layout requested (centered modal).
                             */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-slate-950 border-slate-700" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo</Label>
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                                            <SelectItem value="INCOME">Ingreso</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Statistical Checkbox */}
                            {formData.type === 'EXPENSE' && (
                                <div className="flex items-center space-x-2 pt-2">
                                    <input type="checkbox" id="isStatisticalEdit" checked={formData.isStatistical} onChange={e => setFormData({ ...formData, isStatistical: e.target.checked })} className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600" />
                                    <label htmlFor="isStatisticalEdit" className="text-sm text-slate-400">Estadístico (Tarjeta)</label>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Monto</Label>
                                    <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="bg-slate-950 border-slate-700" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Moneda</Label>
                                    <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                                        <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            <SelectItem value="ARS">ARS</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={formData.categoryId} onValueChange={v => setFormData({ ...formData, categoryId: v, subCategoryId: '' })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {categories.filter(c => c.type === formData.type).map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Sub Categoría</Label>
                                <Select value={formData.subCategoryId} onValueChange={v => setFormData({ ...formData, subCategoryId: v })} disabled={!categories.find(c => c.id === formData.categoryId)?.subCategories?.length}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue placeholder="..." /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {categories.find(c => c.id === formData.categoryId)?.subCategories?.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border-slate-700" />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="button" onClick={() => setEditingId(null)} variant="outline" className="flex-1 bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</Button>
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"><Save className="mr-2 h-4 w-4" /> Actualizar</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4">
                        Movimientos
                        <span className="text-slate-500 font-normal ml-2 text-sm">
                            {(filterMonth !== 'ALL' || filterYear !== 'ALL') && `(${filterMonth !== 'ALL' ? format(new Date(2024, parseInt(filterMonth), 1), 'MMMM') : ''} ${filterYear !== 'ALL' ? filterYear : ''})`}
                        </span>
                    </h3>

                    {transactions
                        .filter(tx => {
                            const date = new Date(tx.date);
                            // UTC fix check
                            const utcDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60000);

                            // 1. Statistical Filter
                            if (filterStatistical) {
                                if (!tx.isStatistical) return false;
                            }

                            // 2. Year Filter
                            if (filterYear !== 'ALL') {
                                if (utcDate.getFullYear().toString() !== filterYear) return false;
                            }

                            // 3. Month Filter
                            if (filterMonth !== 'ALL') {
                                if (utcDate.getMonth().toString() !== filterMonth) return false;
                            }

                            return true;
                        })
                        .reduce((groups: any[], tx) => {
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
                                                <th className="px-4 py-2 text-right w-[100px]">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800 bg-slate-950">
                                            {group.items.map((tx: any) => (
                                                <tr key={tx.id} className={`hover:bg-slate-900/50 ${tx.status === 'PROJECTED' ? 'italic opacity-80' : ''}`}>
                                                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                                        {format(tx.utcDate, 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1">
                                                            {tx.status === 'PROJECTED' ? (
                                                                <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800 w-fit">PROY</span>
                                                            ) : (
                                                                <span className="text-[10px] bg-emerald-900/50 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800 w-fit">REAL</span>
                                                            )}
                                                            {tx.isStatistical && (
                                                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 w-fit" title="No suma al total">ESTADÍSTICO</span>
                                                            )}
                                                        </div>
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
                                                        <div className="flex justify-end items-center gap-3">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                                                                onClick={() => handleEdit(tx)}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                                            </Button>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(tx.id)}
                                                                onChange={() => toggleSelection(tx.id)}
                                                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 outline-none"
                                                            />
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
            {/* Choice Dialog */}
            <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Editar Cuota</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-4">
                        <p className="text-slate-300 text-sm">Este movimiento pertenece a un plan de cuotas.</p>
                        <div className="flex gap-4">
                            <Button
                                onClick={() => {
                                    setChoiceDialogOpen(false);
                                    if (selectedTxForChoice) startEditingTransaction(selectedTxForChoice);
                                }}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
                            >
                                Solo esta cuota
                            </Button>
                            <Button
                                onClick={handleEditPlan}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Todo el Plan
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <InstallmentsDialog
                open={installmentsDialogOpen}
                onOpenChange={(open: boolean) => {
                    setInstallmentsDialogOpen(open);
                    if (!open) {
                        setPlanEditId(null);
                        setPlanInitialData(null);
                    }
                }}
                onSuccess={loadData}
                categories={categories}
                editId={planEditId}
                initialData={planInitialData}
            />
        </div >
    );
}

// End of component


// ... (Exported TransactionsTab)
