'use client';

import { useEffect, useState } from 'react';
import { calculateFIFO } from '@/app/lib/fifo';

interface Crypto {
    id: string;
    ticker: string;
    name: string;
    lastPrice: number;
    transactions: Array<{
        id: string;
        date: string;
        type: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        commission: number;
    }>;
}

export default function TenenciaTab() {
    const [cryptos, setCryptos] = useState<Crypto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCryptos();
    }, []);

    const fetchCryptos = async () => {
        try {
            const res = await fetch('/api/investments/crypto');
            if (res.ok) {
                const json = await res.json();
                setCryptos(json);
            }
        } catch (error) {
            console.error('Error fetching cryptos:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center text-slate-400">Cargando...</div>;
    }

    // Calculate holdings using FIFO
    const holdings = cryptos.map(crypto => {
        const fifoTxs = crypto.transactions.map(t => ({
            id: t.id,
            date: new Date(t.date),
            type: t.type,
            quantity: t.quantity,
            price: t.price,
            commission: t.commission,
            currency: 'USD'
        }));

        const fifoResult = calculateFIFO(fifoTxs, crypto.ticker);

        const totalQuantity = fifoResult.openPositions.reduce((sum, p) => sum + p.quantity, 0);
        const totalCost = fifoResult.openPositions.reduce((sum, p) =>
            sum + (p.quantity * p.buyPrice) + p.buyCommission, 0
        );
        const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
        const currentValue = totalQuantity * crypto.lastPrice;
        const unrealizedPnL = currentValue - totalCost;
        const unrealizedPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;

        return {
            ...crypto,
            quantity: totalQuantity,
            avgPrice,
            currentValue,
            unrealizedPnL,
            unrealizedPercent
        };
    }).filter(h => h.quantity > 0); // Only show holdings with quantity > 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Tenencias Actuales</h2>
                <div className="text-slate-400">
                    {holdings.length} {holdings.length === 1 ? 'posición' : 'posiciones'} abiertas
                </div>
            </div>

            {holdings.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4">💰</div>
                    <h3 className="text-xl font-semibold mb-2">No hay posiciones abiertas</h3>
                    <p className="text-slate-400">
                        Añade tu primera operación de compra en la pestaña Operaciones
                    </p>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Crypto</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Cantidad</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Precio Promedio</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Precio Actual</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Valor Actual</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">P&L No Realizado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {holdings.map((holding) => (
                                    <tr key={holding.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-semibold">{holding.ticker}</div>
                                                <div className="text-sm text-slate-400">{holding.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {holding.quantity.toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 8
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            ${holding.avgPrice.toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            ${holding.lastPrice.toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-semibold">
                                            ${holding.currentValue.toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`font-semibold ${holding.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {holding.unrealizedPnL >= 0 ? '+' : ''}
                                                ${holding.unrealizedPnL.toLocaleString('en-US', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                })}
                                            </div>
                                            <div className={`text-sm ${holding.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {holding.unrealizedPnL >= 0 ? '+' : ''}{holding.unrealizedPercent.toFixed(2)}%
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
