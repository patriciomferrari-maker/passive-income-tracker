'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Upload, Search, Pencil, ArrowUpRight, FileDown, History } from 'lucide-react';
import { format } from 'date-fns';
import { BulkImportDialog } from '@/components/on/BulkImportDialog';
import RegisterSaleModal from "@/components/common/RegisterSaleModal";
import { TransactionFormModal } from '@/components/common/TransactionFormModal';
import { Checkbox } from '@/components/ui/checkbox';

interface ON {
    id: string;
    ticker: string;
    description: string;
    name: string; // Added for TransactionFormModal compatibility
    currency?: string;
    type?: string;
    lastPrice?: number;
}

interface Transaction {
    id: string;
    date: string;
    quantity: number;
    price: number;
    commission: number;
    totalAmount: number;
    currency: string;
    type?: string;
    investment: { ticker: string; description: string; type?: string; lastPrice?: number | null };
}

export function PurchasesTab() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [assets, setAssets] = useState<ON[]>([]);

    // View Config
    const [viewType, setViewType] = useState<string>('ALL');
    const [viewAction, setViewAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL'); // Added Filter
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' }); // Added Sort

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showImport, setShowImport] = useState(false);

    // Transaction Modal (Create/Edit)
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTxId, setEditingTxId] = useState<string | null>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showValues, setShowValues] = useState(true);

    // Fetch Assets (for filter/modal)
    useEffect(() => {
        fetch('/api/investments/on?market=ARG')
            .then(res => res.json())
            .then(data => {
                const mapped = data.map((d: any) => ({
                    ...d,
                    description: d.description || d.name,
                    name: d.name || d.description
                }));
                setAssets(mapped);
            })
            .catch(err => console.error('Error fetching assets:', err));

        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) setShowValues(savedPrivacy === 'true');
    }, []);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (viewType !== 'ALL') params.append('type', viewType);
            params.append('market', 'ARG');

            const res = await fetch(`/api/investments/transactions?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch transactions');
            const data = await res.json();
            setTransactions(data);
            setSelectedIds(new Set()); // Clear selection on refresh
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [refreshTrigger, viewType]);

    const handleEditTransaction = (tx: Transaction) => {
        setEditingTxId(tx.id);
        setIsTxModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta transacción?')) return;
        try {
            await fetch(`/api/investments/transactions/${id}`, { method: 'DELETE' });
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`¿Estás seguro de eliminar las ${selectedIds.size} transacciones seleccionadas?`)) return;

        try {
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    fetch(`/api/investments/transactions/${id}`, { method: 'DELETE' })
                )
            );
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Error deleting transactions:', error);
            alert('Hubo un error al eliminar algunas transacciones.');
        }
    };

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const handleCloseTxModal = () => {
        setIsTxModalOpen(false);
        setEditingTxId(null);
    };

    // Filter Logic
    const filteredTransactions = transactions.filter(tx => {
        const matchesSearch = tx.investment.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.investment.description.toLowerCase().includes(searchTerm.toLowerCase());

        // Action Filter
        let matchesAction = true;
        const isSell = tx.totalAmount >= 0;
        if (viewAction === 'BUY') matchesAction = !isSell;
        if (viewAction === 'SELL') matchesAction = isSell;

        return matchesSearch && matchesAction;
    });

    // Sort Logic
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.key === 'date') {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        } else if (sortConfig.key === 'ticker') {
            valA = a.investment.ticker;
            valB = b.investment.ticker;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Selection Logic
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(sortedTransactions.map(tx => tx.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                            <History className="text-blue-500" />
                            Operaciones
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Registro completo de compras y ventas
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {/* Action Filter */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 mr-2">
                            {[
                                { id: 'ALL', label: 'Todas' },
                                { id: 'BUY', label: 'Compras' },
                                { id: 'SELL', label: 'Ventas' }
                            ].map(ft => (
                                <button
                                    key={ft.id}
                                    onClick={() => setViewAction(ft.id as any)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewAction === ft.id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    {ft.label}
                                </button>
                            ))}
                        </div>

                        {/* Type Filter */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                            {['ALL', 'ON', 'CEDEAR', 'ETF'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setViewType(type)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewType === type
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    {type === 'ALL' ? 'Todos' : type}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>

                    <div className="flex justify-between items-center mb-6">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Buscar activo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                            />
                        </div>
                        <div className="flex gap-2">
                            {selectedIds.size > 0 && (
                                <Button
                                    variant="destructive"
                                    onClick={handleBulkDelete}
                                    className="gap-2 bg-red-600 hover:bg-red-700 text-white animate-in fade-in"
                                >
                                    <Trash2 size={16} />
                                    Eliminar ({selectedIds.size})
                                </Button>
                            )}
                            <Button
                                onClick={() => { setEditingTxId(null); setIsTxModalOpen(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            >
                                <Plus size={16} />
                                Nueva Compra
                            </Button>
                            <Button
                                onClick={() => setShowSaleModal(true)}
                                className="bg-red-600 hover:bg-red-700 text-white gap-2 border-0"
                            >
                                <ArrowUpRight size={16} />
                                Registrar Venta
                            </Button>
                            <Button variant="ghost" onClick={() => setShowImport(true)} className="text-slate-400 hover:text-white">
                                <FileDown size={16} />
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-md border border-slate-800 bg-slate-900/50 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400">
                                <tr>
                                    <th className="w-10 px-4 py-3 text-center">
                                        <Checkbox
                                            checked={sortedTransactions.length > 0 && selectedIds.size === sortedTransactions.length}
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-white hover:bg-slate-800/50" onClick={() => requestSort('date')}>
                                        Fecha {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-white hover:bg-slate-800/50" onClick={() => requestSort('ticker')}>
                                        Activo {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium">Clase</th>
                                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                                    <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                                    <th className="px-4 py-3 text-right font-medium">Precio</th>
                                    <th className="px-4 py-3 text-right font-medium">Comisión</th>
                                    <th className="px-4 py-3 text-right font-medium">Total</th>
                                    <th className="px-4 py-3 text-right font-medium">Orig.</th>
                                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Cargando historial...</td></tr>
                                ) : sortedTransactions.length === 0 ? (
                                    <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No hay operaciones registradas</td></tr>
                                ) : (
                                    sortedTransactions.map((tx) => {
                                        const isSell = tx.totalAmount >= 0;
                                        // Show original values directly

                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3 text-center">
                                                    <Checkbox
                                                        checked={selectedIds.has(tx.id)}
                                                        onCheckedChange={(checked) => handleSelectRow(tx.id, !!checked)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                                    {format(new Date(tx.date), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-white">
                                                    <div className="flex flex-col">
                                                        <span>{tx.investment.ticker}</span>
                                                        <span className="text-xs text-slate-500">{tx.investment.description}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-400 text-xs">
                                                    {tx.investment.type || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-white">
                                                    <Badge variant={isSell ? "destructive" : "default"} className={isSell ? "bg-red-900/50 text-red-200 hover:bg-red-900 border-red-800" : "bg-green-900/50 text-green-200 hover:bg-green-900 border-green-800"}>
                                                        {isSell ? 'VENTA' : 'COMPRA'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                                                    {tx.quantity}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                                                    {!showValues ? '****' : Intl.NumberFormat(tx.currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: tx.currency }).format(tx.price)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">
                                                    {!showValues ? '****' : Intl.NumberFormat(tx.currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: tx.currency }).format(tx.commission)}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-medium tabular-nums ${isSell ? 'text-green-400' : 'text-red-400'}`}>
                                                    {!showValues ? '****' : Intl.NumberFormat(tx.currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: tx.currency }).format(Math.abs(tx.totalAmount))}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500 text-xs">
                                                    {tx.currency || 'ARS'}
                                                </td>
                                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditTransaction(tx)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(tx.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>


            {showSaleModal && (
                <RegisterSaleModal
                    onClose={() => setShowSaleModal(false)}
                    onSuccess={handleSuccess}
                    assets={assets}
                />
            )}

            {showImport && (
                <BulkImportDialog
                    onClose={() => setShowImport(false)}
                    onSuccess={handleSuccess}
                />
            )}

            <TransactionFormModal
                isOpen={isTxModalOpen}
                onClose={handleCloseTxModal}
                onSuccess={handleSuccess}
                initialData={editingTxId ? {
                    id: editingTxId,
                    date: '', // Fetched by component
                    quantity: 0,
                    price: 0,
                    commission: 0,
                    currency: 'ARS'
                } : null}
                assets={assets}
            />
        </div>
    );
}
