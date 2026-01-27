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
    quantity?: number;
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

export function PurchasesTab({ market = 'ARG' }: { market?: string }) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [assets, setAssets] = useState<ON[]>([]);

    // View Config
    const [viewType, setViewType] = useState<string>('ALL');
    const [viewAction, setViewAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
    const [viewCurrency, setViewCurrency] = useState<'ARS' | 'USD'>('USD'); // DEFAULT: USD

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

    interface PositionStats {
        quantity: number;
        invested: number; // Cost Basis (Price * Qty + Comm)
        commission: number; // Total Comm for Open
        ppp: number; // Weighted Avg Price (Invested / Quantity)
        lastPrice: number;
        currentValue: number;
        currency: string;
    }

    const [positionStats, setPositionStats] = useState<Record<string, PositionStats>>({});

    // Fetch Assets and Positions
    useEffect(() => {
        Promise.all([
            fetch(`/api/investments/on?market=${market}&t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()),
            fetch(`/api/investments/positions?type=${market === 'US' ? 'TREASURY,ETF,STOCK' : 'ON,CORPORATE_BOND,ETF,CEDEAR'}&market=${market}&currency=${viewCurrency}&t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json())
        ]).then(([assetsData, positionsData]) => {
            const stats: Record<string, PositionStats> = {};

            // Build Map of Assets for Price
            const assetMap = new Map<string, any>();
            assetsData.forEach((a: any) => assetMap.set(a.ticker, a));

            if (Array.isArray(positionsData)) {
                positionsData.forEach((p: any) => {
                    // Only sum OPEN positions for the "Current Holdings" view
                    if (p.status === 'OPEN') {
                        const ticker = p.ticker;
                        if (!stats[ticker]) {
                            // Init
                            const asset = assetMap.get(ticker) || {};
                            stats[ticker] = {
                                quantity: 0,
                                invested: 0,
                                commission: 0,
                                ppp: 0,
                                lastPrice: asset.lastPrice || 0,
                                currentValue: 0,
                                currency: p.currency
                            };
                        }

                        stats[ticker].quantity += p.quantity;
                        stats[ticker].commission += p.buyCommission;
                        // Invested = Cost Basis (Price * Qty + Comm)
                        const cost = (p.quantity * p.buyPrice) + p.buyCommission;
                        stats[ticker].invested += cost;
                    }
                });
            }

            // Calc PPP and Value
            Object.values(stats).forEach(s => {
                if (s.quantity > 0) {
                    s.ppp = s.invested / s.quantity;
                    s.currentValue = s.quantity * s.lastPrice;
                }
            });

            // Better: Sum Current Value from positions directly
            if (Array.isArray(positionsData)) {
                Object.keys(stats).forEach(k => { stats[k].currentValue = 0; }); // Reset to sum accurately
                positionsData.forEach((p: any) => {
                    if (p.status === 'OPEN' && stats[p.ticker]) {
                        // positionsData returns 'sellPrice' as Current Market Price
                        const val = p.quantity * p.sellPrice;
                        stats[p.ticker].currentValue += val;
                        // Update lastPrice from this source if mostly available
                        if (p.sellPrice > 0) stats[p.ticker].lastPrice = p.sellPrice;
                    }
                });
            }

            setPositionStats(stats);

            // Update Assets List for Modals
            const qtyMap = new Map<string, number>();
            Object.entries(stats).forEach(([t, s]) => {
                // Map by ticker? Modals use ID?
                // We need ID mapping.
                const asset = assetMap.get(t);
                if (asset) qtyMap.set(asset.id, s.quantity);
            });

            const mapped = assetsData.map((d: any) => ({
                ...d,
                description: d.description || d.name,
                name: d.name || d.description,
                quantity: qtyMap.get(d.id) || 0
            }));
            setAssets(mapped);
        }).catch(err => console.error('Error fetching assets/positions:', err));

        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) setShowValues(savedPrivacy === 'true');
    }, [market, refreshTrigger, viewCurrency]); // Added viewCurrency dependency

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (viewType !== 'ALL') params.append('type', viewType);
            params.append('market', market);

            const res = await fetch(`/api/investments/transactions?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch transactions');
            const data = await res.json();

            // Load exchange rates for currency conversion
            const resRates = await fetch('/api/economic-data/tc');
            const ratesData = await resRates.json();
            const exchangeRates: Record<string, number> = {};
            ratesData.forEach((r: any) => {
                const dateKey = new Date(r.date).toISOString().split('T')[0];
                exchangeRates[dateKey] = r.value;
            });

            // Helper to get exchange rate for a date
            const getRate = (date: string) => {
                if (Object.keys(exchangeRates).length === 0) return 1;
                const dateKey = new Date(date).toISOString().split('T')[0];
                if (exchangeRates[dateKey]) return exchangeRates[dateKey];
                const sortedDates = Object.keys(exchangeRates).sort();
                const closestDate = sortedDates.reverse().find(d => d <= dateKey);
                return closestDate ? exchangeRates[closestDate] : 1200;
            };

            // Convert transactions based on viewCurrency
            const convertedData = data.map((tx: Transaction) => {
                const txCurrency = tx.currency || 'USD';
                let totalAmount = tx.totalAmount;
                let price = tx.price;
                let commission = tx.commission;

                if (txCurrency !== viewCurrency) {
                    const rate = getRate(tx.date);
                    if (txCurrency === 'ARS' && viewCurrency === 'USD') {
                        totalAmount = totalAmount / rate;
                        price = price / rate;
                        commission = commission / rate;
                    } else if (txCurrency === 'USD' && viewCurrency === 'ARS') {
                        totalAmount = totalAmount * rate;
                        price = price * rate;
                        commission = commission * rate;
                    }
                }

                return { ...tx, totalAmount, price, commission, currency: viewCurrency };
            });

            setTransactions(convertedData);
            setSelectedIds(new Set());

            // Auto-expand all tickers (show operations always expanded)
            const tickerList = convertedData.map((tx: Transaction) => tx.investment.ticker);
            const uniqueTickers = new Set<string>(tickerList);
            setExpandedTickers(uniqueTickers);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [refreshTrigger, viewType, viewCurrency]); // Added viewCurrency dependency

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
                        {/* Type Filter */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                            {(market === 'US' ? ['ALL', 'TREASURY', 'ETF', 'STOCK'] : ['ALL', 'ON', 'CEDEAR']).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setViewType(type)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewType === type
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    {type === 'ALL' ? 'Todos' : type === 'TREASURY' ? 'Treasuries' : type === 'ETF' ? 'ETFs' : type === 'STOCK' ? 'Stocks' : type}
                                </button>
                            ))}
                        </div>

                        {/* Currency Toggle */}
                        {/* Currency Toggle */}
                        {market !== 'US' && (
                            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 ml-2">
                                <button
                                    onClick={() => setViewCurrency('ARS')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewCurrency === 'ARS'
                                        ? 'bg-blue-900/50 text-blue-200 border border-blue-800'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    ARS
                                </button>
                                <button
                                    onClick={() => setViewCurrency('USD')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewCurrency === 'USD'
                                        ? 'bg-green-900/50 text-green-200 border border-green-800'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    USD
                                </button>
                            </div>
                        )}
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
                                <Upload size={16} />
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
                                            const stats = positionStats[group.ticker];
                                            const hasStats = !!stats && stats.quantity > 0;

                                            // Fallback to group aggregation if no stats (e.g. all closed)
                                            // The user asked for "Posicion de cada activo" (Current).
                                            // If position is closed (Qty=0), we show 0 or "Closed".
                                            // But displaying "Invested" works for history? 
                                            // "Totalizador con la posicion" -> usually means OPEN position.

                                            // If no open position, we show "--"
                                            const nominals = hasStats ? stats.quantity : 0;
                                            const invested = hasStats ? stats.invested : 0;
                                            const ppp = hasStats ? stats.ppp : 0;
                                            const currentVal = hasStats ? stats.currentValue : 0;
                                            const result = currentVal - invested;
                                            const resultPercent = invested > 0 ? (result / invested) * 100 : 0;

                                            return (
                                                <div key={group.ticker} className="border border-slate-800 rounded-lg bg-slate-900/30 overflow-hidden">
                                                    {/* Asset Header */}
                                                    <div
                                                        className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors border-b border-slate-800/50"
                                                        onClick={() => toggleTicker(group.ticker)}
                                                    >
                                                        <div className="grid grid-cols-[1fr,auto] gap-4">
                                                            <div className="flex items-center gap-3">
                                                                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                                                <div>
                                                                    <div className="font-medium text-white flex items-center gap-2">
                                                                        {group.ticker}
                                                                        <span className="text-xs font-normal text-slate-500">
                                                                            ({group.transactions.length} ops)
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-slate-400">{group.description}</div>
                                                                </div>
                                                            </div>

                                                            {/* Totalizer Stats aligned with table headers */}
                                                            <div className="flex items-center gap-0 text-sm">
                                                                {/* Quantity alignment */}
                                                                <div className="w-[100px] text-right pr-4 border-r border-slate-800/30">
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Nominales</div>
                                                                    <div className="font-mono font-bold text-slate-100">
                                                                        {Intl.NumberFormat('es-AR').format(nominals)}
                                                                    </div>
                                                                </div>

                                                                {/* PPP alignment */}
                                                                <div className="w-[120px] text-right pr-4 border-r border-slate-800/30 hidden sm:block">
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">PPP</div>
                                                                    <div className="font-mono font-medium text-slate-200">
                                                                        {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(ppp)}
                                                                    </div>
                                                                </div>

                                                                {/* Commission alignment */}
                                                                <div className="w-[120px] text-right pr-4 border-r border-slate-800/30 hidden md:block">
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Comisión</div>
                                                                    <div className="font-mono text-slate-400">
                                                                        {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency, minimumFractionDigits: 2 }).format(hasStats ? stats.commission : 0)}
                                                                    </div>
                                                                </div>

                                                                {/* Total Invested alignment */}
                                                                <div className="w-[140px] text-right pr-4 border-r border-slate-800/30">
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Invertido</div>
                                                                    <div className="font-mono font-bold text-blue-400">
                                                                        {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(invested)}
                                                                    </div>
                                                                </div>

                                                                {/* Result alignment */}
                                                                <div className="w-[120px] text-right pr-2 hidden lg:block">
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Resultado</div>
                                                                    <div className={`font-mono font-bold ${result >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {!showValues ? '****' : `${result >= 0 ? '+' : ''}${resultPercent.toFixed(2)}%`}
                                                                    </div>
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
                market={market}
            />
        </div>
    );
}
