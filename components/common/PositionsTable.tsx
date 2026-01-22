import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, ChevronRight, ChevronDown } from 'lucide-react';

interface PositionEvent {
    id: string;
    ticker: string;
    name: string;
    date: string;
    status: 'OPEN' | 'CLOSED';
    quantity: number;
    buyPrice: number;
    buyCommission: number;
    sellPrice: number;
    sellCommission: number;
    resultAbs: number;
    resultPercent: number;
    currency: string;
    type?: string;
    theoreticalTir?: number;
    priceResult?: number;
    fxResult?: number;
    buyExchangeRate?: number;
    sellExchangeRate?: number;
}

interface AssetGroup {
    ticker: string;
    name: string;
    type: string;
    currency: string;
    positions: PositionEvent[];

    // Aggregated Data
    totalNominals: number;
    avgBuyPrice: number; // Weighted Average for Open positions
    totalInvestedOriginal: number; // For Open positions (Cost Basis)
    totalCurrentValue: number;

    // Results
    totalRealizedResult: number; // From CLOSED positions
    totalUnrealizedResult: number; // From OPEN positions (Market Value - Cost)
    totalResult: number; // Realized + Unrealized

    avgClosePrice?: number; // For fully closed positions context
}

interface PositionsTableProps {
    types?: string;
    market?: string;
    currency?: string;
    refreshTrigger?: number;
    onEdit?: (positionId: string) => void;
}

export default function PositionsTable({ types, market, currency, refreshTrigger, onEdit }: PositionsTableProps) {
    const [positions, setPositions] = useState<PositionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'ticker', direction: 'asc' });
    const [showValues, setShowValues] = useState(true);
    const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());

    const loadData = async () => {
        try {
            const params = new URLSearchParams();
            if (types) params.append('type', types);
            if (market) params.append('market', market);
            if (currency) params.append('currency', currency);

            const url = `/api/investments/positions?${params.toString()}`;

            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch positions');
            const data = await res.json();
            setPositions(data);
        } catch (error) {
            console.error('Error loading positions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [refreshTrigger, types, currency]);

    useEffect(() => {
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

    const formatMoney = (amount: number, currency: string) => {
        if (!showValues) return '****';
        return Intl.NumberFormat('es-AR', { style: 'currency', currency: currency }).format(amount);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleExpand = (ticker: string) => {
        const newSet = new Set(expandedTickers);
        if (newSet.has(ticker)) {
            newSet.delete(ticker);
        } else {
            newSet.add(ticker);
        }
        setExpandedTickers(newSet);
    };

    // Grouping Logic
    const groupedAssets = useMemo(() => {
        const groups = new Map<string, AssetGroup>();

        positions.forEach(pos => {
            if (!groups.has(pos.ticker)) {
                groups.set(pos.ticker, {
                    ticker: pos.ticker,
                    name: pos.name,
                    type: pos.type || '',
                    currency: pos.currency,
                    positions: [],
                    totalNominals: 0,
                    avgBuyPrice: 0,
                    totalInvestedOriginal: 0,
                    totalCurrentValue: 0,
                    totalRealizedResult: 0,
                    totalUnrealizedResult: 0,
                    totalResult: 0
                });
            }

            const group = groups.get(pos.ticker)!;
            group.positions.push(pos);

            // Aggregate Data
            if (pos.status === 'OPEN') {
                group.totalNominals += pos.quantity;
                group.totalInvestedOriginal += (pos.quantity * pos.buyPrice) + pos.buyCommission;
                group.totalCurrentValue += (pos.quantity * (pos.sellPrice || 0)); // sellPrice is currentPrice for OPEN
                group.totalUnrealizedResult += pos.resultAbs;
            } else {
                group.totalRealizedResult += pos.resultAbs;
            }

            group.totalResult += pos.resultAbs;
        });

        // Calculate Averages and Finalize Groups
        return Array.from(groups.values()).map(group => {
            if (group.totalNominals > 0) {
                // Avg Buy Price for OPEN positions (Weighted)
                // We use totalInvestedOriginal (Cost Basis) / Total Nominals
                // Note: buyCommission is included in cost basis, so avg price effectively includes commission impact if desired, 
                // but visually users usually expect execution price. 
                // Let's use pure Weighted Avg Price relative to Quantity for display?
                // Standard: Cost Basis / Quantity => Break Even Price
                group.avgBuyPrice = group.totalInvestedOriginal / group.totalNominals;
            }

            // Sort positions chronologically
            group.positions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            return group;
        });

    }, [positions]);

    const sortedGroups = useMemo(() => {
        if (!sortConfig) return groupedAssets;

        return [...groupedAssets].sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof AssetGroup];
            let bValue: any = b[sortConfig.key as keyof AssetGroup];

            // Handle specific sorting keys mapping
            if (sortConfig.key === 'result') {
                aValue = a.totalResult;
                bValue = b.totalResult;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [groupedAssets, sortConfig]);


    if (loading) return <div className="text-slate-400 text-sm py-4">Cargando posiciones...</div>;

    // Totals for Cards
    const totalUnrealized = groupedAssets.reduce((sum, g) => sum + g.totalUnrealizedResult, 0);
    const totalRealized = groupedAssets.reduce((sum, g) => sum + g.totalRealizedResult, 0);

    // To calculate % we need total costs
    const totalCostUnrealized = groupedAssets.reduce((sum, g) => sum + g.totalInvestedOriginal, 0);
    const unrealizedPercent = totalCostUnrealized !== 0 ? (totalUnrealized / totalCostUnrealized) * 100 : 0;

    // For Realized %, it's harder to get agg cost from group structure without storing it, but let's calc from positions
    const totalCostRealized = positions
        .filter(p => p.status === 'CLOSED')
        .reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);
    const realizedPercent = totalCostRealized !== 0 ? (totalRealized / totalCostRealized) * 100 : 0;

    const hasEquityAssets = groupedAssets.some(g => {
        const t = (g.type || '').toUpperCase();
        return !['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(t);
    });

    // Totals Footer
    const totalInvestedGlobal = positions.reduce((sum, p) => sum + (p.quantity * p.buyPrice + p.buyCommission), 0); // All time invested? Or just current? Usually dashboard shows current value.
    // The footer in original code summed ALL buy prices (Open + Closed). Let's keep consistency.
    const totalPrecioCompraAll = positions.reduce((sum, p) => sum + (p.quantity * p.buyPrice + p.buyCommission), 0);
    const totalValorActualAll = groupedAssets.reduce((sum, g) => sum + g.totalCurrentValue, 0);
    const totalResultAll = groupedAssets.reduce((sum, g) => sum + g.totalResult, 0);

    return (
        <div className="mt-8 space-y-4">
            {hasEquityAssets && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">Resultado No Realizado (Abiertas)</h4>
                        <div className="flex items-center justify-between w-full">
                            <div className={`text-2xl font-bold w-1/2 text-center border-r border-slate-800 ${totalUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatMoney(totalUnrealized, currency || 'USD')}
                            </div>
                            <div className={`text-2xl font-medium w-1/2 text-center ${unrealizedPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {unrealizedPercent > 0 ? '+' : ''}{unrealizedPercent.toFixed(2)}%
                            </div>
                        </div>
                    </div>
                    <div className=" bg-slate-900 border border-slate-800 rounded-lg p-6">
                        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 text-center">Resultado Realizado (Cerradas)</h4>
                        <div className="flex items-center justify-between w-full">
                            <div className={`text-2xl font-bold w-1/2 text-center border-r border-slate-800 ${totalRealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatMoney(totalRealized, currency || 'USD')}
                            </div>
                            <div className={`text-2xl font-medium w-1/2 text-center ${realizedPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {realizedPercent > 0 ? '+' : ''}{realizedPercent.toFixed(2)}%
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-md border border-slate-800 bg-slate-900/50 overflow-hidden mt-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-slate-400">
                            <tr>
                                <th className="px-4 py-3 text-left w-8"></th>
                                <th className="px-4 py-3 text-left font-medium">
                                    <button onClick={() => handleSort('ticker')} className="flex items-center gap-1 hover:text-white">
                                        Activo
                                        {sortConfig?.key === 'ticker' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">Nominales</th>
                                <th className="px-4 py-3 text-right font-medium">PPC / Precio</th>
                                <th className="px-4 py-3 text-right font-medium text-emerald-400">Valor Actual</th>
                                <th className="px-4 py-3 text-right font-medium">
                                    <button onClick={() => handleSort('result')} className="flex items-center gap-1 hover:text-white ml-auto">
                                        Resultado Total
                                        {sortConfig?.key === 'result' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">% Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {sortedGroups.map((group) => {
                                const isExpanded = expandedTickers.has(group.ticker);
                                // Total Result % = Total Result / (Total Invested of Open + Cost of Closed)
                                // Simplified for Display: Unrealized % if Open, Realized % if Closed?
                                // Let's show: (Total Result / Total Invested Ever) if possible, or (Current Result / Current Invested)
                                // Standard: If has Open, show Unrealized % on Current Holdings. If fully closed, show Realized %.

                                let displayPercent = 0;
                                if (group.totalNominals > 0) {
                                    displayPercent = group.totalInvestedOriginal !== 0
                                        ? (group.totalUnrealizedResult / group.totalInvestedOriginal) * 100
                                        : 0;
                                } else {
                                    // Fully closed aggregation
                                    // We need cost of closed positions for this group
                                    const closedCost = group.positions.reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);
                                    displayPercent = closedCost !== 0 ? (group.totalRealizedResult / closedCost) * 100 : 0;
                                }

                                return (
                                    <>
                                        {/* PARENT ROW */}
                                        <tr
                                            key={group.ticker}
                                            className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-800/30' : ''}`}
                                            onClick={() => toggleExpand(group.ticker)}
                                        >
                                            <td className="px-4 py-4 text-slate-500">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-white text-base">{group.ticker}</div>
                                                <div className="text-xs text-slate-500">{group.name}</div>
                                            </td>
                                            <td className="px-4 py-4 text-right text-white tabular-nums font-medium">
                                                {group.totalNominals > 0 ? group.totalNominals : <span className="text-slate-600">0</span>}
                                            </td>
                                            <td className="px-4 py-4 text-right text-slate-300 tabular-nums">
                                                {group.totalNominals > 0 ? (
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span>{formatMoney(group.avgBuyPrice, group.currency)}</span>
                                                        <span className="text-[10px] text-slate-500">PPC</span>
                                                    </div>
                                                ) : '-'}

                                            </td>
                                            <td className="px-4 py-4 text-right text-emerald-400 font-bold tabular-nums">
                                                {group.totalNominals > 0 ? formatMoney(group.totalCurrentValue, group.currency) : '-'}
                                            </td>
                                            <td className={`px-4 py-4 text-right font-bold tabular-nums ${group.totalResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatMoney(group.totalResult, group.currency)}
                                            </td>
                                            <td className={`px-4 py-4 text-right font-medium tabular-nums ${displayPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {displayPercent.toFixed(2)}%
                                            </td>
                                        </tr>

                                        {/* CHILD ROWS (EXPANDED) */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="bg-slate-900/40 p-0 border-b border-slate-800">
                                                    <div className="border-l-2 border-slate-700 ml-8 my-2">
                                                        <table className="w-full text-xs">
                                                            <thead className="text-slate-500 bg-slate-900/20">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-left">Fecha</th>
                                                                    <th className="px-4 py-2 text-left">Estado</th>
                                                                    <th className="px-4 py-2 text-right">Nominales</th>
                                                                    <th className="px-4 py-2 text-right">Precio Compra</th>
                                                                    <th className="px-4 py-2 text-right">Precio Venta</th>
                                                                    <th className="px-4 py-2 text-right">Resultado</th>
                                                                    <th className="px-4 py-2 text-right">Acción</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800/50">
                                                                {group.positions.map(pos => (
                                                                    <tr key={pos.id} className="hover:bg-slate-800/30">
                                                                        <td className="px-4 py-2 text-slate-300">
                                                                            {format(new Date(pos.date), 'dd/MM/yyyy')}
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border ${pos.status === 'OPEN'
                                                                                    ? 'border-green-900 text-green-500 bg-green-900/10'
                                                                                    : 'border-red-900 text-red-500 bg-red-900/10'
                                                                                }`}>
                                                                                {pos.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right text-slate-300">
                                                                            {pos.quantity}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right text-slate-400">
                                                                            {formatMoney(pos.buyPrice, pos.currency)}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right text-slate-400">
                                                                            {pos.sellPrice > 0 ? formatMoney(pos.sellPrice, pos.currency) : '-'}
                                                                        </td>
                                                                        <td className={`px-4 py-2 text-right ${pos.resultAbs >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            {formatMoney(pos.resultAbs, pos.currency)}
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right">
                                                                            {onEdit && pos.status === 'OPEN' && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onEdit(pos.id);
                                                                                    }}
                                                                                    className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                                                                                >
                                                                                    <Pencil size={12} />
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-900/80 border-t border-slate-700 font-bold text-white">
                            <tr>
                                <td colSpan={2} className="px-4 py-4 text-right text-slate-400">TOTALES GLOBAL</td>
                                <td className="px-4 py-4"></td>
                                <td className="px-4 py-4 text-right text-slate-300 tabular-nums">
                                    {/* Cost skipped or summarized? */}
                                </td>
                                <td className="px-4 py-4 text-right text-emerald-400 tabular-nums border-l border-slate-800 bg-emerald-950/20">
                                    {formatMoney(totalValorActualAll, currency || 'USD')}
                                </td>
                                <td className={`px-4 py-4 text-right tabular-nums ${totalResultAll >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatMoney(totalResultAll, currency || 'USD')}
                                </td>
                                <td className="px-4 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
