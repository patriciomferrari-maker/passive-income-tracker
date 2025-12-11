'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Eye, EyeOff, CheckSquare, Square, Trash, AlertTriangle, Edit, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import PositionsTable from "@/components/common/PositionsTable";
import RegisterSaleModal from "@/components/common/RegisterSaleModal";

interface Treasury {
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
    type?: string; // Add type field
    investment: {
        ticker: string;
        name: string;
        type: string;
        lastPrice?: number;
    };
}

export function PurchasesTab() {
    const [treasuries, setTreasuries] = useState<Treasury[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showValues, setShowValues] = useState(true);

    // Filter State
    const [filterType, setFilterType] = useState<'ALL' | 'TREASURY' | 'ETF'>('ALL');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteType, setDeleteType] = useState<'single' | 'bulk'>('single');
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Edit State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Form state
    const [selectedTreasury, setSelectedTreasury] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [commission, setCommission] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

    // FIFO State
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedTransactions = () => {
        // First filter by type
        let filtered = transactions;
        if (filterType !== 'ALL') {
            filtered = transactions.filter(tx => tx.investment.type === filterType);
        }

        if (!sortConfig) return filtered;

        return [...filtered].sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof Transaction];
            let bValue: any = b[sortConfig.key as keyof Transaction];

            // Handle nested properties
            if (sortConfig.key === 'ticker') {
                aValue = a.investment.ticker;
                bValue = b.investment.ticker;
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    const loadData = async () => {
        try {
            // Fetch with specific types: TREASURY and ETF
            const [treasuriesRes, txRes] = await Promise.all([
                fetch('/api/investments/treasury', { cache: 'no-store' }),
                fetch('/api/investments/transactions?type=TREASURY,ETF', { cache: 'no-store' })
            ]);

            const treasuriesData = await treasuriesRes.json();
            const txData = await txRes.json();

            // No client-side filtering needed anymore
            setTreasuries(treasuriesData);
            setTransactions(txData);
            setSelectedIds([]); // Reset selection on reload
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

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
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleSaleSuccess = () => {
        setShowSaleModal(false);
        setRefreshTrigger(prev => prev + 1); // Refresh FIFO table
        loadData(); // Refresh holdings
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        let success = false;

        try {
            if (editingTransaction) {
                // Update existing transaction
                const res = await fetch(`/api/investments/transactions/${editingTransaction.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date,
                        quantity,
                        price,
                        commission
                    })
                });

                if (!res.ok) throw new Error('Failed to update transaction');
            } else {
                // Create new transaction
                const res = await fetch(`/api/investments/treasury/${selectedTreasury}/transactions`, {
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
            }
            success = true;
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert(editingTransaction ? 'Error al actualizar la compra' : 'Error al registrar la compra');
        } finally {
            setSubmitting(false);
        }

        if (success) {
            setShowForm(false);
            resetForm();
            // Reload data in a separate try-catch to avoid showing false saving errors
            try {
                await loadData();
                setRefreshTrigger(prev => prev + 1); // Also refresh positions
            } catch (loadError) {
                console.error("Error refreshing data after save:", loadError);
            }
        }
    };

    const resetForm = () => {
        setSelectedTreasury('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setQuantity('');
        setPrice('');
        setCommission('0');
        setEditingTransaction(null);
    };

    const handleEdit = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setDate(format(new Date(transaction.date), 'yyyy-MM-dd'));
        setQuantity(transaction.quantity.toString());
        setPrice(transaction.price.toString());
        setCommission(transaction.commission.toString());
        setShowForm(true);
    };

    const confirmDelete = (id: string) => {
        setDeleteType('single');
        setItemToDelete(id);
        setShowDeleteConfirm(true);
    };

    const confirmBulkDelete = () => {
        setDeleteType('bulk');
        setShowDeleteConfirm(true);
    };

    const executeDelete = async () => {
        setShowDeleteConfirm(false);

        if (deleteType === 'single' && itemToDelete) {
            try {
                const res = await fetch(`/api/investments/transactions/${itemToDelete}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Failed to delete');
                await loadData();
                setRefreshTrigger(prev => prev + 1);
            } catch (error) {
                console.error('Error deleting transaction:', error);
                alert('Error al eliminar la compra');
            }
        } else if (deleteType === 'bulk') {
            try {
                for (const id of selectedIds) {
                    const res = await fetch(`/api/investments/transactions/${id}`, {
                        method: 'DELETE'
                    });
                    if (!res.ok) console.error(`Failed to delete transaction ${id}`);
                }
                await loadData();
                setRefreshTrigger(prev => prev + 1);
                setSelectedIds([]);
            } catch (error) {
                console.error('Error deleting selected transactions:', error);
                alert('Error al eliminar las compras');
            }
        }

        setItemToDelete(null);
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
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Inversiones USA</CardTitle>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setShowSaleModal(true)}
                            className="bg-red-900/40 border border-red-900 text-red-100 hover:bg-red-900/60"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Registrar Venta
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowValues(!showValues)}
                            title={showValues ? "Ocultar montos" : "Mostrar montos"}
                            className="text-slate-400 hover:text-white"
                        >
                            {showValues ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                        <Button
                            onClick={() => setShowForm(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Compra
                        </Button>
                    </div>
                </div>
                <CardDescription className="text-slate-400">
                    Gestiona tus Treasuries y ETFs
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="positions" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                        <TabsTrigger value="positions">Posiciones</TabsTrigger>
                        <TabsTrigger value="history">Historial de Compras</TabsTrigger>
                    </TabsList>

                    <TabsContent value="positions" className="mt-4 space-y-4">
                        {/* Button moved to header */}
                        <PositionsTable types="TREASURY,ETF" market="US" refreshTrigger={refreshTrigger} />
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="flex justify-between items-center my-4">
                            {/* Type Filter */}
                            <div className="bg-slate-900 rounded-md border border-slate-700 p-1 flex">
                                <button
                                    onClick={() => setFilterType('ALL')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${filterType === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilterType('TREASURY')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${filterType === 'TREASURY' ? 'bg-blue-900/50 text-blue-200' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Treasuries
                                </button>
                                <button
                                    onClick={() => setFilterType('ETF')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${filterType === 'ETF' ? 'bg-purple-900/50 text-purple-200' : 'text-slate-400 hover:text-white'}`}
                                >
                                    ETFs
                                </button>
                            </div>

                            {selectedIds.length > 0 && (
                                <Button
                                    onClick={confirmBulkDelete}
                                    variant="outline"
                                    className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                >
                                    <Trash className="h-4 w-4 mr-2" />
                                    Eliminar ({selectedIds.length})
                                </Button>
                            )}
                        </div>

                        {loading ? (
                            <div className="text-slate-400 text-center py-12">Cargando...</div>
                        ) : transactions.length === 0 ? (
                            <div className="text-slate-400 text-center py-12">
                                No hay compras registradas.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-md border border-slate-800">
                                <table className="w-full">
                                    <thead className="bg-slate-900/50">
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
                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">Tipo</th>
                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">
                                                <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-white">
                                                    Fecha
                                                    {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                                    {sortConfig?.key !== 'date' && <ArrowUpDown size={14} className="opacity-50" />}
                                                </button>
                                            </th>
                                            <th className="text-left py-3 px-4 text-slate-300 font-medium">
                                                <button onClick={() => handleSort('ticker')} className="flex items-center gap-1 hover:text-white">
                                                    Ticker
                                                    {sortConfig?.key === 'ticker' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                                    {sortConfig?.key !== 'ticker' && <ArrowUpDown size={14} className="opacity-50" />}
                                                </button>
                                            </th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Cantidad</th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Precio</th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">ComisiÃ³n</th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Total</th>
                                            <th className="text-right py-3 px-4 text-slate-300 font-medium">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getSortedTransactions().map((tx) => {
                                            const totalPaid = Math.abs(tx.totalAmount);
                                            return (
                                                <tr key={tx.id} className={`border-b border-white/5 hover:bg-white/5 ${selectedIds.includes(tx.id) ? 'bg-white/10' : ''}`}>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => toggleSelection(tx.id)}
                                                            className={`hover:text-white ${selectedIds.includes(tx.id) ? 'text-blue-400' : 'text-slate-500'}`}
                                                        >
                                                            {selectedIds.includes(tx.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${(tx.type || 'BUY') === 'SELL'
                                                            ? 'bg-red-900/50 text-red-200 border border-red-800'
                                                            : 'bg-green-900/50 text-green-200 border border-green-800'
                                                            }`}>
                                                            {(tx.type || 'BUY') === 'SELL' ? 'VENTA' : 'COMPRA'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-white">
                                                        {format(new Date(tx.date), 'dd/MM/yyyy')}
                                                    </td>
                                                    <td className="py-3 px-4 text-white">
                                                        <div className="flex flex-col">
                                                            <div>
                                                                <span className="font-bold">{tx.investment.ticker}</span>
                                                                {tx.investment.type === 'ETF' && (
                                                                    <span className="ml-2 text-[10px] bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-800">ETF</span>
                                                                )}
                                                            </div>
                                                            <span className="text-slate-400 text-xs hidden md:inline">{tx.investment.name}</span>
                                                        </div>
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
                                                    <td className="py-3 px-4 text-white text-right font-mono text-slate-400">
                                                        {formatMoney(totalPaid)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleEdit(tx)}
                                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                                                title="Editar compra"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => confirmDelete(tx.id)}
                                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                                title="Eliminar compra"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>

            {/* New Transaction Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">{editingTransaction ? 'Editar Compra' : 'Nueva Compra'}</CardTitle>
                            <CardDescription className="text-slate-400">
                                {editingTransaction ? 'Modifica los datos de la compra' : 'Registra una nueva operaciÃ³n de compra'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Treasury</label>
                                    {editingTransaction ? (
                                        <div className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white">
                                            <span className="font-bold">{editingTransaction.investment.ticker}</span>
                                            <span className="text-slate-400 ml-2">- {editingTransaction.investment.name}</span>
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={selectedTreasury}
                                            onChange={(e) => setSelectedTreasury(e.target.value)}
                                            className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                        >
                                            <option value="">Seleccionar Treasury...</option>
                                            {treasuries.map(treasury => (
                                                <option key={treasury.id} value={treasury.id}>
                                                    {treasury.ticker} - {treasury.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                        <label className="text-sm font-medium text-slate-300">ComisiÃ³n</label>
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

            {/* Register Sale Modal */}
            {showSaleModal && (
                <RegisterSaleModal
                    assets={treasuries}
                    onClose={() => setShowSaleModal(false)}
                    onSuccess={handleSaleSuccess}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <AlertTriangle className="text-red-500" />
                                Confirmar EliminaciÃ³n
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                {deleteType === 'single'
                                    ? 'Â¿EstÃ¡s seguro de que deseas eliminar esta compra? Esta acciÃ³n no se puede deshacer.'
                                    : `Â¿EstÃ¡s seguro de que deseas eliminar las ${selectedIds.length} compras seleccionadas? Esta acciÃ³n no se puede deshacer.`
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    onClick={executeDelete}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Eliminar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </Card>
    );
}
