'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Upload, Trash, CheckSquare, Square, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { BulkImportDialog } from '@/components/on/BulkImportDialog';

interface ON {
    id: string;
    ticker: string;
    name: string;
}

interface Transaction {
    id: string;
    date: string;
    quantity: number;
    price: number;
    commission: number;
    totalAmount: number;
    investment: { ticker: string; name: string };
}

export function PurchasesTab() {
    const [ons, setOns] = useState<ON[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showImport, setShowImport] = useState(false);

    const [showValues, setShowValues] = useState(true);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Form state
    const [selectedON, setSelectedON] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [commission, setCommission] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }

        const handlePrivacyChange = () => {
            const savedPrivacy = localStorage.getItem('privacy_mode');
            if (savedPrivacy !== null) {
                setShowValues(savedPrivacy === 'true');
            }
        };
        window.addEventListener('privacy-changed', handlePrivacyChange);
        return () => window.removeEventListener('privacy-changed', handlePrivacyChange);
    }, []);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
        window.dispatchEvent(new Event('privacy-changed'));
    };

    const formatMoney = (amount: number) => {
        if (!showValues) return '****';
        return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const loadData = async () => {
        try {
            const [onsRes, txRes] = await Promise.all([
                fetch('/api/investments/on'),
                fetch('/api/investments/transactions')
            ]);

            const onsData = await onsRes.json();
            const txData = await txRes.json();

            setOns(onsData);
            setTransactions(txData);
            setSelectedIds([]); // Reset selection on reload
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch(`/api/investments/on/${selectedON}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    quantity,
                    price,
                    commission
                })
            });

            if (!res.ok) throw new Error('Failed to create transaction');

            await loadData();
            setShowForm(false);
            resetForm();
        } catch (error) {
            console.error('Error creating transaction:', error);
            alert('Error al registrar la compra');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedON('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setQuantity('');
        setPrice('');
        setCommission('0');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta compra?')) return;

        try {
            const res = await fetch(`/api/investments/transactions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            await loadData();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Error al eliminar la compra');
        }
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`¿Estás seguro de que quieres eliminar las ${selectedIds.length} compras seleccionadas?`)) {
            return;
        }

        try {
            // Delete all selected transactions
            // Ideally we should have a bulk delete API, but loop is fine for now
            for (const id of selectedIds) {
                const res = await fetch(`/api/investments/transactions/${id}`, {
                    method: 'DELETE'
                });
                if (!res.ok) console.error(`Failed to delete transaction ${id}`);
            }

            await loadData();
            alert('Compras seleccionadas eliminadas');
        } catch (error) {
            console.error('Error deleting selected transactions:', error);
            alert('Error al eliminar las compras');
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === transactions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(transactions.map(tx => tx.id));
        }
    };

    return (
        <>
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                        Registro de Compras
                        <div className="flex gap-2">
                            <Button
                                onClick={togglePrivacy}
                                variant="outline"
                                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                                title={showValues ? "Ocultar montos" : "Mostrar montos"}
                            >
                                {showValues ? <EyeOff size={16} /> : <Eye size={16} />}
                            </Button>
                            {selectedIds.length > 0 && (
                                <Button
                                    onClick={handleDeleteSelected}
                                    variant="outline"
                                    className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Eliminar ({selectedIds.length})
                                </Button>
                            )}
                            <Button
                                onClick={() => setShowImport(true)}
                                className="bg-slate-700 hover:bg-slate-600 text-white"
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                Importar CSV
                            </Button>
                            <Button
                                onClick={() => setShowForm(true)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Nueva Compra
                            </Button>
                        </div>
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                        Historial de operaciones de compra de ONs
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay compras registradas.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="w-10 py-3 px-4">
                                            <button
                                                onClick={toggleSelectAll}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                {selectedIds.length === transactions.length && transactions.length > 0 ? (
                                                    <CheckSquare size={18} />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Ticker</th>
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Cantidad</th>
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Precio</th>
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Comisión</th>
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Total</th>
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className={`border-b border-white/5 hover:bg-white/5 ${selectedIds.includes(tx.id) ? 'bg-white/10' : ''}`}>
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => toggleSelection(tx.id)}
                                                    className={`hover:text-white ${selectedIds.includes(tx.id) ? 'text-blue-400' : 'text-slate-500'}`}
                                                >
                                                    {selectedIds.includes(tx.id) ? (
                                                        <CheckSquare size={18} />
                                                    ) : (
                                                        <Square size={18} />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="py-3 px-4 text-white">
                                                {format(new Date(tx.date), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="py-3 px-4 text-white">
                                                <span className="font-bold">{tx.investment.ticker}</span>
                                                <span className="text-slate-400 text-xs ml-2 hidden md:inline">{tx.investment.name}</span>
                                            </td>
                                            <td className="py-3 px-4 text-white text-right font-mono">
                                                {tx.quantity}
                                            </td>
                                            <td className="py-3 px-4 text-white text-right font-mono">
                                                {formatMoney(tx.price)}
                                            </td>
                                            <td className="py-3 px-4 text-white text-right font-mono">
                                                {formatMoney(tx.commission)}
                                            </td>
                                            <td className="py-3 px-4 text-white text-right font-mono font-bold">
                                                {formatMoney(Math.abs(tx.totalAmount))}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(tx.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Eliminar compra"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* New Transaction Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Nueva Compra</CardTitle>
                            <CardDescription className="text-slate-400">
                                Registra una nueva operación de compra
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Obligación Negociable</label>
                                    <select
                                        required
                                        value={selectedON}
                                        onChange={(e) => setSelectedON(e.target.value)}
                                        className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                    >
                                        <option value="">Seleccionar ON...</option>
                                        {ons.map(on => (
                                            <option key={on.id} value={on.id}>
                                                {on.ticker} - {on.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Fecha</label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Cantidad</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            step="1"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Precio</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="any"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Comisión</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="any"
                                            value={commission}
                                            onChange={(e) => setCommission(e.target.value)}
                                            className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowForm(false)}
                                        className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        {submitting ? 'Guardando...' : 'Guardar'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {showImport && (
                <BulkImportDialog
                    onClose={() => setShowImport(false)}
                    onSuccess={() => {
                        setShowImport(false);
                        loadData();
                    }}
                />
            )}
        </>
    );
}
