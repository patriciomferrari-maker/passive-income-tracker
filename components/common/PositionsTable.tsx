'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface PositionEvent {
    id: string;
    ticker: string;
    name: string;
    date: string; // Purchase or Sale Date based on context, but API returns one main date.
    // Ideally we want both dates. API returns 'date' which is SaleDate for Closed, PurchaseDate for Open.
    status: 'OPEN' | 'CLOSED';
    quantity: number;
    buyPrice: number; // or buyPriceAvg
    buyCommission: number; // or buyCommissionPaid
    sellPrice: number;
    sellCommission: number;
    resultAbs: number;
    resultPercent: number;
    currency: string;
}

interface PositionsTableProps {
    types?: string; // Comma separated types to filter initial fetch
    refreshTrigger?: number;
}

export default function PositionsTable({ types, refreshTrigger }: PositionsTableProps) {
    const [positions, setPositions] = useState<PositionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
    const [showValues, setShowValues] = useState(true);

    const loadData = async () => {
        try {
            const url = types
                ? `/api/investments/positions?type=${types}`
                : '/api/investments/positions';

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
    }, [refreshTrigger, types]);

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
    if (positions.length === 0) return null; // Don't show if empty? Or show empty message?

    return (
        <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold text-white px-2">Posiciones (Lotes FIFO)</h3>
            <div className="rounded-md border border-slate-800 bg-slate-900/50 overflow-hidden">
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
                                        Fecha
                                        {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">Nominales</th>
                                <th className="px-4 py-3 text-right font-medium">Precio Compra</th>
                                <th className="px-4 py-3 text-right font-medium">Com. Compra</th>
                                <th className="px-4 py-3 text-right font-medium">Precio Venta</th>
                                <th className="px-4 py-3 text-right font-medium">Com. Venta</th>
                                <th className="px-4 py-3 text-right font-medium">Resultado</th>
                                <th className="px-4 py-3 text-right font-medium">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {getSortedPositions().map((pos) => (
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
                                        {format(new Date(pos.date), 'dd/MM/yyyy')}
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
                                        {formatMoney(pos.resultAbs, pos.currency)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${pos.resultPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {pos.resultPercent?.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
