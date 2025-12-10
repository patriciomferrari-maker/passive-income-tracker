'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, Trash, CheckSquare, Square, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { BulkImportDialog } from '@/components/on/BulkImportDialog';
import PositionsTable from "@/components/common/PositionsTable";
import RegisterSaleModal from "@/components/common/RegisterSaleModal";

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
    type?: string; // Add type field
    investment: { ticker: string; name: string; type?: string; lastPrice?: number | null };
}

export function PurchasesTab() {
    const [ons, setOns] = useState<ON[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showImport, setShowImport] = useState(false);

    const [showValues, setShowValues] = useState(true);

    // Filter State
    // ON tab includes ON and CORPORATE_BOND
    const [filterType, setFilterType] = useState<'ALL' | 'ON' | 'CORPORATE_BOND'>('ALL');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Form state
    const [selectedON, setSelectedON] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [commission, setCommission] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    // FIFO State
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

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
            const [onsRes, txRes] = await Promise.all([
                fetch('/api/investments/on', { cache: 'no-store' }),
                fetch('/api/investments/transactions?type=ON,CORPORATE_BOND', { cache: 'no-store' })
            ]);

            const onsData = await onsRes.json();
            const txData = await txRes.json();

            // No client-side filtering needed anymore
            setOns(onsData);
            setTransactions(txData);
            setSelectedIds([]); // Reset selection on reload
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaleSuccess = () => {
        setShowSaleModal(false);
        setRefreshTrigger(prev => prev + 1); // Refresh FIFO table
        loadData(); // Refresh holdings
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
        return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        let success = false;

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
            success = true;
        } catch (error) {
            console.error('Error creating transaction:', error);
            alert('Error al registrar la compra');
        } finally {
            setSubmitting(false);
        }

        if (success) {
            setShowForm(false);
            resetForm();
            try {
                await loadData();
                setRefreshTrigger(prev => prev + 1);
            } catch (loadError) {
                console.error("Error reloading after save:", loadError);
            }
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
        if (!confirm('Â¿EstÃ¡s seguro de eliminar esta compra?')) return;

        try {
            const res = await fetch(`/api/investments/transactions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            await loadData();
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Error deleting transaction:', error);
            alert('Error al eliminar la compra');
        }
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`Â¿EstÃ¡s seguro de que quieres eliminar las ${selectedIds.length} compras seleccionadas?`)) {
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
            setRefreshTrigger(prev => prev + 1);
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
        <Card className="bg-slate-950 border-slate-800">
        </Button>
                    </div >
                </div >
        <CardDescription className="text-slate-300">
            Historial de operaciones de compra de ONs
        </CardDescription>
            </CardHeader >
        <CardContent>
            <Tabs defaultValue="positions" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                    {/* Type Filter */}
                    <div className="bg-slate-900 rounded-md border border-slate-700 p-1 flex">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterType === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterType('ON')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterType === 'ON' ? 'bg-blue-900/50 text-blue-200' : 'text-slate-400 hover:text-white'}`}
                        >
                            ONs
                        </button>
                        <button
                            onClick={() => setFilterType('CORPORATE_BOND')}
                            className={`px-3 py-1 text-sm rounded transition-colors ${filterType === 'CORPORATE_BOND' ? 'bg-purple-900/50 text-purple-200' : 'text-slate-400 hover:text-white'}`}
                        >
                            Bonos Corp
                        </button>
                    </div>

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
                                {getSortedTransactions().map((tx) => (
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
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${(tx.investment.type === 'SELL' || (tx as any).type === 'SELL')
                                                ? 'bg-red-900/50 text-red-200 border border-red-800'
                                                : 'bg-green-900/50 text-green-200 border border-green-800'
                                                }`}>
                                                {(tx.investment.type === 'SELL' || (tx as any).type === 'SELL') ? 'VENTA' : 'COMPRA'}
                                            </span>
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
            </TabsContent>
        </Tabs>
        </CardContent >

        {/* New Transaction Form Modal */ }
    {
        showForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Nueva Compra</CardTitle>
                        <CardDescription className="text-slate-400">
                            Registra una nueva operaciÃ³n de compra
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">ObligaciÃ³n Negociable</label>
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
        )
    }

    {
        showImport && (
            <BulkImportDialog
                onClose={() => setShowImport(false)}
                onSuccess={() => {
                    setShowImport(false);
                    loadData();
                }}
            />
        )
    }

    {/* Register Sale Modal */ }
    {
        showSaleModal && (
            <RegisterSaleModal
                assets={ons}
                onClose={() => setShowSaleModal(false)}
                onSuccess={handleSaleSuccess}
                priceDivisor={100}
            />
        )
    }
        </Card >
    );
}
