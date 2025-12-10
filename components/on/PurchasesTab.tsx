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
    const [viewCurrency, setViewCurrency] = useState<'ARS' | 'USD'>('USD');
    const [viewType, setViewType] = useState<string>('ALL');

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
                // Map description to name if needed, api returns description
                const mapped = data.map((d: any) => ({
                    ...d,
                    description: d.description || d.name,
                    name: d.name || d.description // Ensure name exists 
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
        return matchesSearch;
    });

    // Helper for History Display - Rates Logic
    const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
    useEffect(() => {
        fetch('/api/admin/economic?limit=5000')
            .then(res => res.json())
            .then(data => {
                const map: Record<string, number> = {};
                if (Array.isArray(data)) {
                    data.forEach((item: any) => {
                        const dateStr = new Date(item.date).toISOString().split('T')[0];
                        map[dateStr] = item.value;
                    });
                }
                setRatesMap(map);
            });
    }, []);

    const getRate = (dateStr: string) => {
        const d = dateStr.split('T')[0];
        if (ratesMap[d]) return ratesMap[d];

        // Simple fallback to closest previous if exact date missing
        const target = new Date(d).getTime();
        let bestDiff = Infinity;
        let bestRate = 0;

        for (const [k, v] of Object.entries(ratesMap)) {
            const t = new Date(k).getTime();
            if (t <= target) {
                const diff = target - t;
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestRate = v;
                }
            }
        }
        return bestRate || 1000; // Fallback
    };

    const convertValue = (val: number, date: string, fromCurr: string, toCurr: string) => {
        if (fromCurr === toCurr) return val;
        const rate = getRate(date);
        if (!rate) return val;
        if (fromCurr === 'ARS' && toCurr === 'USD') return val / rate;
        if (fromCurr === 'USD' && toCurr === 'ARS') return val * rate;
        return val;
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                            <History className="text-blue-500" />
                            Historial de Operaciones
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Registro completo de compras y ventas
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
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

                        {/* Currency Toggle */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 ml-4">
                            <button
                                onClick={() => setViewCurrency('ARS')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${viewCurrency === 'ARS'
                                    ? 'bg-blue-900/50 text-blue-200 border border-blue-800'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                ARS
                            </button>
                            <button
                                onClick={() => setViewCurrency('USD')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${viewCurrency === 'USD'
                                    ? 'bg-green-900/50 text-green-200 border border-green-800'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                USD
                            </button>
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
                            <Button
                                onClick={() => { setEditingTxId(null); setIsTxModalOpen(true); }}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            >
                                <Plus size={16} />
                                Nueva Compra
                            </Button>
                            <Button variant="outline" onClick={() => setShowSaleModal(true)} className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2">
                                <ArrowUpRight size={16} />
                                Registrar Venta
                            </Button>
                            <Button variant="ghost" onClick={() => setShowImport(true)} className="text-slate-400 hover:text-white">
                                <FileDown size={16} />
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-md border border-slate-800 bg-slate-900/50 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                                    <th className="px-4 py-3 text-left font-medium">Activo</th>
                                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                                    <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                                    <th className="px-4 py-3 text-right font-medium">Precio ({viewCurrency})</th>
                                    <th className="px-4 py-3 text-right font-medium">Comisión ({viewCurrency})</th>
                                    <th className="px-4 py-3 text-right font-medium">Total ({viewCurrency})</th>
                                    <th className="px-4 py-3 text-right font-medium">Orig.</th>
                                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Cargando historial...</td></tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay operaciones registradas</td></tr>
                                ) : (
                                    filteredTransactions.map((tx) => {
                                        const isSell = tx.totalAmount >= 0;
                                        const convertedPrice = convertValue(tx.price, tx.date, tx.currency || 'ARS', viewCurrency);
                                        const convertedComm = convertValue(tx.commission, tx.date, tx.currency || 'ARS', viewCurrency);
                                        const convertedTotal = convertValue(Math.abs(tx.totalAmount), tx.date, tx.currency || 'ARS', viewCurrency);

                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                                                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                                    {format(new Date(tx.date), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-white">
                                                    <div className="flex flex-col">
                                                        <span>{tx.investment.ticker}</span>
                                                        <span className="text-xs text-slate-500">{tx.investment.description}</span>
                                                    </div>
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
                                                    {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(convertedPrice)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">
                                                    {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(convertedComm)}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-medium tabular-nums ${isSell ? 'text-green-400' : 'text-red-400'}`}>
                                                    {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(convertedTotal)}
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
