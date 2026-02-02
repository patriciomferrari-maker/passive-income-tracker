'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Plus, Trash2, Edit2, DollarSign, Calendar } from 'lucide-react';

interface DollarPurchase {
    id: string;
    date: string;
    amount: number;
    rate: number | null;
    amountARS: number | null;
    source: string;
}

export function DollarsTab() {
    const [purchases, setPurchases] = useState<DollarPurchase[]>([]);
    const [sourceOptions, setSourceOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form Stats
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [rate, setRate] = useState('');
    const [source, setSource] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [purRes, srcRes] = await Promise.all([
                fetch('/api/hogar/dollars'),
                fetch('/api/hogar/sources')
            ]);

            const purData = await purRes.json();
            const srcData = await srcRes.json();

            setPurchases(Array.isArray(purData) ? purData : []);
            setSourceOptions(Array.isArray(srcData) ? srcData : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            date,
            amount: parseFloat(amount),
            rate: rate ? parseFloat(rate) : null,
            amountARS: rate && amount ? parseFloat(amount) * parseFloat(rate) : null,
            source
        };

        try {
            const url = editingId ? `/api/hogar/dollars/${editingId}` : '/api/hogar/dollars';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save');

            await loadData();
            resetForm();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este registro?')) return;
        try {
            await fetch(`/api/hogar/dollars/${id}`, { method: 'DELETE' });
            setPurchases(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    const handleEdit = (p: DollarPurchase) => {
        setEditingId(p.id);
        setDate(new Date(p.date).toISOString().split('T')[0]);
        setAmount(p.amount.toString());
        setRate(p.rate?.toString() || '');
        setSource(p.source);
    };

    const resetForm = () => {
        setEditingId(null);
        setDate(new Date().toISOString().split('T')[0]);
        setAmount('');
        setRate('');
        setSource('');
    };

    // --- Stats & Cashflow ---

    const totalUSD = purchases.reduce((sum, p) => sum + p.amount, 0);

    // Calculate average rate only for transactions that have a rate
    const purchasesWithRate = purchases.filter(p => p.rate && p.rate > 0);
    const totalUSDWithRate = purchasesWithRate.reduce((sum, p) => sum + p.amount, 0);
    const weightedSum = purchasesWithRate.reduce((sum, p) => sum + (p.rate || 0) * p.amount, 0);
    const avgRate = totalUSDWithRate > 0 ? weightedSum / totalUSDWithRate : 0;

    // Group by Source and Month
    const months = Array.from(new Set(purchases.map(p => new Date(p.date).toISOString().slice(0, 7)))).sort();
    // Merge existing sources from DB + any historical sources not in DB list anymore
    const allSources = Array.from(new Set([
        ...sourceOptions.map(s => s.name),
        ...purchases.map(p => p.source)
    ])).sort();

    const getAmountForSourceAndMonth = (s: string, m: string) => {
        return purchases
            .filter(p => p.source === s && new Date(p.date).toISOString().startsWith(m))
            .reduce((sum, p) => sum + p.amount, 0);
    };

    const getTotalForMonth = (m: string) => {
        return purchases
            .filter(p => new Date(p.date).toISOString().startsWith(m))
            .reduce((sum, p) => sum + p.amount, 0);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Acumulado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400">
                            ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 hidden md:block">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Promedio Compra</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                            ${avgRate.toLocaleString('es-AR', { minimumFractionDigits: 1 })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                            {editingId ? 'Editar Compra' : 'Registrar Compra'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-slate-300">Fecha</Label>
                                <div className="relative">
                                    <Input
                                        id="date"
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white pl-10 focus:border-blue-500"
                                        required
                                    />
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount" className="text-slate-300">Monto (USD)</Label>
                                <div className="relative">
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white pl-10 focus:border-emerald-500"
                                        placeholder="100.00"
                                        required
                                    />
                                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="rate" className="text-slate-300">Cotización (ARS)</Label>
                                <Input
                                    id="rate"
                                    type="number"
                                    step="0.01"
                                    value={rate}
                                    onChange={e => setRate(e.target.value)}
                                    className="bg-slate-950 border-slate-700 text-white focus:border-blue-500"
                                    placeholder="e.g. 1200"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="source" className="text-slate-300">Concepto / Origen</Label>
                                <Select value={source} onValueChange={setSource} required>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                        <SelectValue placeholder="Seleccionar Fuente..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {sourceOptions.length === 0 && <SelectItem value="temp" disabled>No hay fuentes creadas (ir a Configuración)</SelectItem>}
                                        {sourceOptions.map((s: any) => (
                                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                        ))}
                                        {/* If editing and source not in list, show it */}
                                        {editingId && source && !sourceOptions.find(s => s.name === source) && (
                                            <SelectItem value={source}>{source} (Archivado)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : (editingId ? 'Actualizar' : 'Guardar')}
                                </Button>
                                {editingId && (
                                    <Button type="button" variant="outline" onClick={resetForm} className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Cashflow Table */}
                <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-white">Cashflow Mensual</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-slate-800 hover:bg-slate-900">
                                        <TableHead className="text-slate-300">Origen</TableHead>
                                        {months.map(m => (
                                            <TableHead key={m} className="text-right text-slate-300 whitespace-nowrap">
                                                {format(new Date(m + '-02T00:00:00'), 'MMM yy', { locale: es })}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-right text-emerald-400 font-bold">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allSources.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={months.length + 2} className="text-center text-slate-500 py-8">
                                                No hay movimientos registrados
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {allSources.map(s => {
                                        const totalRow = purchases.filter(p => p.source === s).reduce((sum, p) => sum + p.amount, 0);
                                        return (
                                            <TableRow key={s} className="border-slate-800 hover:bg-slate-800/50">
                                                <TableCell className="font-medium text-slate-200">{s}</TableCell>
                                                {months.map(m => {
                                                    const val = getAmountForSourceAndMonth(s, m);
                                                    return (
                                                        <TableCell key={m} className="text-right text-slate-400">
                                                            {val > 0 ? val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                                                        </TableCell>
                                                    );
                                                })}
                                                <TableCell className="text-right font-bold text-emerald-400">
                                                    {totalRow.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}

                                    {/* Footer / Totals */}
                                    {months.length > 0 && (
                                        <TableRow className="border-t-2 border-slate-700 hover:bg-slate-900 font-bold bg-slate-950/50">
                                            <TableCell className="text-white">TOTAL</TableCell>
                                            {months.map(m => (
                                                <TableCell key={m} className="text-right text-emerald-400">
                                                    {getTotalForMonth(m).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right text-emerald-400 text-lg">
                                                {totalUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Recent Transactions List (Mini) */}
                        <div className="mt-8 border-t border-slate-800 pt-6">
                            <h3 className="text-sm font-medium text-slate-400 mb-4">Últimos Movimientos</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {purchases.slice(0, 20).map(p => {
                                    // Parse date string artificially as local time to prevent timezone shift
                                    const dateStr = p.date.toString().split('T')[0];
                                    const displayDate = new Date(dateStr + 'T00:00:00');

                                    return (
                                        <div key={p.id} className="flex items-center justify-between p-3 rounded bg-slate-950/50 border border-slate-800/50 hover:border-slate-700 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <DollarSign size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{p.source}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {format(displayDate, 'dd MMM yyyy', { locale: es })}
                                                        {p.rate && ` • AR$ ${p.rate}`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono font-medium text-emerald-400">
                                                    +${p.amount.toLocaleString('en-US')}
                                                </span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => handleEdit(p)}>
                                                        <Edit2 size={14} />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30" onClick={() => handleDelete(p.id)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
