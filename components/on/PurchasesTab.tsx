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
        invested: number; // Cost Basis
        ppp: number;
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
                                ppp: 0,
                                lastPrice: asset.lastPrice || 0,
                                currentValue: 0,
                                currency: p.currency
                            };
                        }

                        stats[ticker].quantity += p.quantity;
                        // Invested = Cost Basis (Price * Qty + Comm)
                        // Note: positionsData 'buyPrice' is unit price. 'buyCommission' is total for lot? 
                        // Usually FIFO returns buyCommission apportioned to the lot quantity.
                        const cost = (p.quantity * p.buyPrice) + p.buyCommission;
                        stats[ticker].invested += cost;
                    }
                });
            }

            // Calc PPP and Value
            Object.values(stats).forEach(s => {
                if (s.quantity > 0) {
                    s.ppp = s.invested / s.quantity; // Gross PPP (including comms) or Net? Usually users want Net Price? 
                    // "Invertido" matches sum of costs. PPP = Invested / Qty implies Avg Cost.
                    s.currentValue = s.quantity * s.lastPrice;

                    // Fix for ONs quotes %
                    // If lastPrice is percentage (e.g. 1.02 or 98.00) AND stats say raw nominals.
                    // But we used a heuristic in positions route? 
                    // Let's rely on dashboard/positions logic: If price is raw, just multiply.
                    // But in positions route we normalize price.
                    // asset.lastPrice from 'assetsData' is RAW.
                    // positionsData calculates its own 'sellPrice' (current val) logic.
                    // Maybe we should iterate positionsData again to sum 'currentValue'?
                    // positionsData doesn't return 'currentValue', it returns 'sellPrice' (which is curr price).
                    // Let's use that if possible? 
                    // But 'p.sellPrice' is populated with Current Price in Open Positions logic.
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

    // ... (rest of code) ...

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
                        className="px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
                        onClick={() => toggleTicker(group.ticker)}
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

                            {/* Totalizer Stats */}
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Nominales</div>
                                    <div className="font-mono font-medium text-slate-200">
                                        {Intl.NumberFormat('es-AR').format(nominals)}
                                    </div>
                                </div>

                                {hasStats && (
                                    <>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">PPP</div>
                                            <div className="font-mono text-slate-300">
                                                {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(ppp)}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Invertido</div>
                                            <div className="font-mono font-medium text-slate-200">
                                                {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(invested)}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Valor Actual</div>
                                            <div className="font-mono font-bold text-slate-100">
                                                {!showValues ? '****' : Intl.NumberFormat(viewCurrency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency: viewCurrency }).format(currentVal)}
                                            </div>
                                        </div>

                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Resultado</div>
                                            <div className={`font-mono font-medium ${result >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {!showValues ? '****' : `${result >= 0 ? '+' : ''}${resultPercent.toFixed(2)}%`}
                                            </div>
                                        </div>
                                    </>
                                )}
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
                                </div >
                            ))
                        )
}
                    </div >
                </CardContent >
            </Card >

    { showSaleModal && (
        <RegisterSaleModal
            onClose={() => setShowSaleModal(false)}
            onSuccess={handleSuccess}
            assets={assets}
        />
    )}

{
    showImport && (
        <BulkImportDialog
            onClose={() => setShowImport(false)}
            onSuccess={handleSuccess}
        />
    )
}

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
        </div >
    );
}
