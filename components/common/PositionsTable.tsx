import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react';

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
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
    const [showValues, setShowValues] = useState(true);

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

    const getSortedPositions = () => {
        if (!sortConfig) return positions;

        return [...positions].sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof PositionEvent];
            let bValue: any = b[sortConfig.key as keyof PositionEvent];

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    if (loading) return <div className="text-slate-400 text-sm py-4">Cargando posiciones...</div>;

    const totalRealized = positions
        .filter(p => p.status === 'CLOSED')
        .reduce((sum, p) => sum + (p.resultAbs || 0), 0);

    const totalCostRealized = positions
        .filter(p => p.status === 'CLOSED')
        .reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);

    const realizedPercent = totalCostRealized !== 0 ? (totalRealized / totalCostRealized) * 100 : 0;

    const totalUnrealized = positions
        .filter(p => p.status === 'OPEN')
        .reduce((sum, p) => sum + (p.resultAbs || 0), 0);

    const totalCostUnrealized = positions
        .filter(p => p.status === 'OPEN' && p.sellPrice > 0)
        .reduce((sum, p) => sum + ((p.quantity * p.buyPrice) + p.buyCommission), 0);

    const unrealizedPercent = totalCostUnrealized !== 0 ? (totalUnrealized / totalCostUnrealized) * 100 : 0;

    // Only show P&L cards if there are Equity assets (CEDEAR, ETF, etc.)
    // Logic inverted: Show if there is ANY asset that is NOT a Bond (ON/TREASURY)
    const hasEquityAssets = positions.some(p => {
        const t = (p.type || '').toUpperCase();
        return !['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(t);
    });

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
                                <th className="px-4 py-3 text-left font-medium">
                                    <button onClick={() => handleSort('ticker')} className="flex items-center gap-1 hover:text-white">
                                        Activo
                                        {sortConfig?.key === 'ticker' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                        {sortConfig?.key !== 'ticker' && <ArrowUpDown size={14} className="opacity-50" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left font-medium">Estado</th>
                                <th className="px-4 py-3 text-left font-medium">
                                    <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-white">
                                        Fecha Compra
                                        {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left font-medium">Fecha Venta</th>
                                <th className="px-4 py-3 text-right font-medium">Nominales</th>
                                <th className="px-4 py-3 text-right font-medium">Precio Compra</th>
                                <th className="px-4 py-3 text-right font-medium">Com. Compra</th>
                                <th className="px-4 py-3 text-right font-medium">Precio Venta</th>
                                <th className="px-4 py-3 text-right font-medium">Com. Venta</th>
                                <th className="px-4 py-3 text-right font-medium">Resultado</th>
                                <th className="px-4 py-3 text-right font-medium">%</th>
                                {currency === 'ARS' && (
                                    <>
                                        <th className="px-4 py-3 text-right font-medium text-xs text-yellow-500">Res. TC</th>
                                        <th className="px-4 py-3 text-right font-medium text-xs text-blue-400">Res. Perf.</th>
                                    </>
                                )}
                                <th className="px-4 py-3 text-right font-medium">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {getSortedPositions().map((pos) => {
                                const totalCost = (pos.quantity * pos.buyPrice) + pos.buyCommission;
                                const priceResultPercent = totalCost !== 0 && (pos as any).priceResult ? ((pos as any).priceResult / totalCost) * 100 : 0;
                                const fxResultPercent = totalCost !== 0 && (pos as any).fxResult ? ((pos as any).fxResult / totalCost) * 100 : 0;

                                return (
                                    <tr key={pos.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-white">{pos.ticker}</div>
                                            <div className="text-xs text-slate-500">{pos.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${pos.status === 'OPEN'
                                                ? 'bg-green-900/30 text-green-400 border-green-900'
                                                : 'bg-red-900/30 text-red-400 border-red-900'
                                                }`}>
                                                {pos.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            <div className="flex flex-col">
                                                <span>{pos.status === 'OPEN' ? format(new Date(pos.date), 'dd/MM/yyyy') : '-'}</span>
                                                {currency === 'ARS' && pos.status === 'OPEN' && (pos as any).buyExchangeRate && (
                                                    <span className="text-[10px] text-slate-500">
                                                        TC {Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format((pos as any).buyExchangeRate)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            <div className="flex flex-col">
                                                <span>{pos.status === 'CLOSED' ? format(new Date(pos.date), 'dd/MM/yyyy') : '-'}</span>
                                                {currency === 'ARS' && (pos as any).sellExchangeRate && (
                                                    <span className="text-[10px] text-slate-500">
                                                        TC {Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format((pos as any).sellExchangeRate)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-white tabular-nums">
                                            {pos.quantity}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                                            {formatMoney(pos.buyPrice, pos.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">
                                            {formatMoney(pos.buyCommission, pos.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                                            {pos.sellPrice > 0 ? formatMoney(pos.sellPrice, pos.currency) : '-'}
                                            {pos.status === 'OPEN' && <span className="text-[10px] text-slate-500 ml-1">(Actual)</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">
                                            {pos.status === 'CLOSED' ? formatMoney(pos.sellCommission, pos.currency) : '-'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${pos.resultAbs >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(pos.sellPrice > 0 || pos.status === 'CLOSED') ? formatMoney(pos.resultAbs, pos.currency) : '-'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium tabular-nums ${pos.resultPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(pos.sellPrice > 0 || pos.status === 'CLOSED') && pos.resultPercent !== undefined ? `${pos.resultPercent?.toFixed(2)}%` : '-'}
                                        </td>

                                        {currency === 'ARS' && (
                                            <>
                                                <td className="px-4 py-3 text-right font-medium tabular-nums text-yellow-500">
                                                    <div className="flex flex-col items-end">
                                                        <span>{(pos as any).fxResult ? formatMoney((pos as any).fxResult, currency) : '-'}</span>
                                                        <span className="text-[10px] opacity-70">
                                                            {(pos as any).fxResult ? `${fxResultPercent.toFixed(2)}%` : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium tabular-nums text-blue-400">
                                                    <div className="flex flex-col items-end">
                                                        <span>{(pos as any).priceResult ? formatMoney((pos as any).priceResult, currency) : '-'}</span>
                                                        <span className="text-[10px] opacity-70">
                                                            {(pos as any).priceResult ? `${priceResultPercent.toFixed(2)}%` : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        <td className="px-4 py-3 text-right">
                                            {onEdit && pos.status === 'OPEN' && (
                                                <button
                                                    onClick={() => onEdit(pos.id)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
