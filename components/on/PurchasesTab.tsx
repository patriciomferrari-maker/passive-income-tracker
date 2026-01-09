'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Upload, Search, Pencil, ArrowUpRight, FileDown, History, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { BulkImportDialog } from '@/components/on/BulkImportDialog';
import RegisterSaleModal from "@/components/common/RegisterSaleModal";
import { TransactionFormModal } from '@/components/common/TransactionFormModal';
import { Checkbox } from '@/components/ui/checkbox';

interface ON {
    id: string;
    ticker: string;
    description: string;
    name: string;
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

interface GroupedAsset {
    ticker: string;
    description: string;
    type: string;
    currentHoldings: number;
    transactions: Transaction[];
}

export function PurchasesTab() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [assets, setAssets] = useState<ON[]>([]);

    // View Config
    const [viewType, setViewType] = useState<string>('ALL');
    const [viewAction, setViewAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL'); // Added Filter

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Expansion State
    const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());

    // Modals
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showImport, setShowImport] = useState(false);

    // Transaction Modal (Create/Edit)
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editingTxId, setEditingTxId] = useState<string | null>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showValues, setShowValues] = useState(true);

    // Fetch Assets
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
            setSelectedIds(new Set());

            // Auto-expand all tickers (show operations always expanded)
            const uniqueTickers = new Set(data.map((tx: Transaction) => tx.investment.ticker));
            setExpandedTickers(uniqueTickers);
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

    // --- Grouping Logic ---

    // 1. Filter Raw Transactions
    const filteredTransactions = transactions.filter(tx => {
        const matchesSearch = tx.investment.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.investment.description.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesAction = true;
        const isSell = tx.totalAmount >= 0;
        if (viewAction === 'BUY') matchesAction = !isSell;
        if (viewAction === 'SELL') matchesAction = isSell;

        return matchesSearch && matchesAction;
    });

    // 2. Group by Type -> Ticker
    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, GroupedAsset>> = {}; // Type -> Ticker -> Data

        filteredTransactions.forEach(tx => {
            const type = tx.investment.type || 'OTRO';
            const ticker = tx.investment.ticker;

            if (!groups[type]) groups[type] = {};
            if (!groups[type][ticker]) {
                groups[type][ticker] = {
                    ticker,
                    description: tx.investment.description,
                    type,
                    currentHoldings: 0,
                    transactions: []
                };
            }

            // Add tx
            groups[type][ticker].transactions.push(tx);

            // Accumulate Holdings (Buy +, Sell -)
            const isSell = tx.totalAmount >= 0;
            if (isSell) {
                groups[type][ticker].currentHoldings -= tx.quantity;
            } else {
                groups[type][ticker].currentHoldings += tx.quantity;
            }
        });

        // Convert to array for rendering
        // Sort Types?
        return groups;
    }, [filteredTransactions]);

    const toggleTicker = (ticker: string) => {
        const newSet = new Set(expandedTickers);
        if (newSet.has(ticker)) newSet.delete(ticker);
        else newSet.add(ticker);
        setExpandedTickers(newSet);
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) newSelected.add(id);
        else newSelected.delete(id);
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
                            Registro histórico agrupado por activo
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
                            {['ALL', 'ON', 'CEDEAR'].map(type => (
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

                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12 text-slate-500">Cargando operaciones...</div>
                        ) : Object.keys(groupedData).length === 0 ? (
                            <div className="text-center py-12 text-slate-500">No hay operaciones registradas</div>
                        ) : (
                            Object.entries(groupedData).sort((a, b) => a[0].localeCompare(b[0])).map(([type, tickersMap]) => (
                                <div key={type} className="animate-in fade-in slide-in-from-left-2 duration-300">
                                    <h3 className="text-lg font-semibold text-slate-200 mb-3 px-2 flex items-center gap-2">
                                        <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700">
                                            {type}
                                        </Badge>
                                    </h3>

                                    <div className="space-y-3">
                                        {Object.values(tickersMap).sort((a, b) => a.ticker.localeCompare(b.ticker)).map(group => {
                                            const isExpanded = expandedTickers.has(group.ticker);
                                            return (
                                                <div key={group.ticker} className="border border-slate-800 rounded-lg bg-slate-900/30 overflow-hidden">
                                                    {/* Asset Header */}
                                                    <div
                                                        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                                                        onClick={() => toggleTicker(group.ticker)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                                            <div>
                                                                <div className="font-medium text-white flex items-center gap-2">
                                                                    {group.ticker}
                                                                    <span className="text-xs font-normal text-slate-500">({group.transactions.length} ops)</span>
                                                                </div>
                                                                <div className="text-xs text-slate-400">{group.description}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <div className="text-xs text-slate-500 uppercase tracking-wider">Nominales</div>
                                                                <div className="font-mono text-slate-200">
                                                                    {Intl.NumberFormat('es-AR').format(group.currentHoldings)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Transactions List */}
                                                    {isExpanded && (
                                                        <div className="border-t border-slate-800/50 bg-slate-950/30">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                                                                        <tr>
                                                                            <th className="px-4 py-2 w-10 text-center"></th>
                                                                            <th className="px-4 py-2 text-left">Fecha</th>
                                                                            <th className="px-4 py-2 text-center">Tipo</th>
                                                                            <th className="px-4 py-2 text-right">Cantidad</th>
                                                                            <th className="px-4 py-2 text-right">Precio</th>
                                                                            <th className="px-4 py-2 text-right">Comisión</th>
                                                                            <th className="px-4 py-2 text-right">Total</th>
                                                                            <th className="px-4 py-2 text-right">Moneda</th>
                                                                            <th className="px-4 py-2 text-right">Acciones</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-800/50">
                                                                        {group.transactions
                                                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Default sort by date desc
                                                                            .map(tx => {
                                                                                const isSell = tx.totalAmount >= 0;
                                                                                return (
                                                                                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                                                                        <td className="px-4 py-2 text-center">
                                                                                            <Checkbox
                                                                                                checked={selectedIds.has(tx.id)}
                                                                                                onCheckedChange={(c) => handleSelectRow(tx.id, !!c)}
                                                                                                className="h-3 w-3"
                                                                                            />
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-slate-300">
                                                                                            {format(new Date(tx.date), 'dd/MM/yyyy')}
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-center">
                                                                                            <Badge variant={isSell ? "destructive" : "default"} className={`h-5 text-[10px] px-1.5 ${isSell ? "bg-red-900/40 text-red-300 border-red-800" : "bg-green-900/40 text-green-300 border-green-800"}`}>
                                                                                                {isSell ? 'VENTA' : 'COMPRA'}
                                                                                            </Badge>
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-right text-slate-300 tabular-nums">
                                                                                            {tx.quantity}
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-right text-slate-300 tabular-nums">
                                                                                            {!showValues ? '****' : Intl.NumberFormat(tx.currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: tx.currency }).format(tx.price)}
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-right text-slate-400 tabular-nums text-xs">
                                                                                            {!showValues ? '****' : Intl.NumberFormat(tx.currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: tx.currency }).format(tx.commission)}
                                                                                        </td>
                                                                                        <td className={`px-4 py-2 text-right font-medium tabular-nums ${isSell ? 'text-green-400' : 'text-red-400'}`}>
                                                                                            {!showValues ? '****' : Intl.NumberFormat(tx.currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: tx.currency }).format(Math.abs(tx.totalAmount))}
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-right text-slate-500 text-xs">
                                                                                            {tx.currency}
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-right flex justify-end gap-1">
                                                                                            <button
                                                                                                onClick={() => handleEditTransaction(tx)}
                                                                                                className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded"
                                                                                            >
                                                                                                <Pencil size={12} />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDelete(tx.id)}
                                                                                                className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"
                                                                                            >
                                                                                                <Trash2 size={12} />
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
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
