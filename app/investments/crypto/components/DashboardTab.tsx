'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, DollarSign } from 'lucide-react';

interface DashboardData {
    totalInvested: number;
    totalCurrentValue: number;
    totalRealized: number;
    totalUnrealized: number;
    totalPnL: number;
    totalPnLPercent: number;
    totalCoins: number;
    totalTransactions: number;
    portfolioBreakdown: Array<{
        ticker: string;
        name: string;
        currentValue: number;
        unrealized: number;
        unrealizedPercent: number;
        quantity: number;
    }>;
    topPerformer: {
        ticker: string;
        name: string;
        unrealizedPercent: number;
    } | null;
}

export default function DashboardTab() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/investments/crypto/dashboard');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center text-slate-400">Cargando...</div>;
    }

    if (!data) {
        return <div className="text-center text-slate-400">No hay datos disponibles</div>;
    }

    const StatCard = ({
        title,
        value,
        change,
        icon: Icon,
        positive
    }: {
        title: string;
        value: string;
        change?: string;
        icon: any;
        positive?: boolean
    }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{title}</span>
                <Icon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold mb-2">{value}</div>
            {change && (
                <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-400' : 'text-red-400'}`}>
                    {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {change}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Invertido"
                    value={`$${data.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={DollarSign}
                />
                <StatCard
                    title="Valor Actual"
                    value={`$${data.totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={Wallet}
                />
                <StatCard
                    title="Ganancia Total"
                    value={`$${data.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    change={`${data.totalPnLPercent > 0 ? '+' : ''}${data.totalPnLPercent.toFixed(2)}%`}
                    icon={TrendingUp}
                    positive={data.totalPnL >= 0}
                />
                <StatCard
                    title="No Realizada"
                    value={`$${data.totalUnrealized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={TrendingUp}
                    positive={data.totalUnrealized >= 0}
                />
            </div>

            {/* Top Performer */}
            {data.topPerformer && (
                <div className="bg-gradient-to-br from-green-950 to-slate-900 border border-green-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-2">🏆 Mejor Rendimiento</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold">{data.topPerformer.ticker}</div>
                            <div className="text-slate-400">{data.topPerformer.name}</div>
                        </div>
                        <div className="text-3xl font-bold text-green-400">
                            +{data.topPerformer.unrealizedPercent.toFixed(2)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Portfolio Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4">Composición del Portfolio</h3>
                {data.portfolioBreakdown.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">
                        No hay inversiones. Añade tu primera crypto en la pestaña Operaciones.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {data.portfolioBreakdown.map((coin) => (
                            <div key={coin.ticker} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                                <div>
                                    <div className="font-semibold text-lg">{coin.ticker}</div>
                                    <div className="text-slate-400 text-sm">{coin.name}</div>
                                    <div className="text-slate-500 text-xs mt-1">
                                        {coin.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })} unidades
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-lg">
                                        ${coin.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className={`text-sm ${coin.unrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {coin.unrealized >= 0 ? '+' : ''}${coin.unrealized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        ({coin.unrealized >= 0 ? '+' : ''}{coin.unrealizedPercent.toFixed(2)}%)
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-slate-400 text-sm">Total Cryptos</div>
                    <div className="text-2xl font-bold">{data.totalCoins}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-slate-400 text-sm">Total Operaciones</div>
                    <div className="text-2xl font-bold">{data.totalTransactions}</div>
                </div>
            </div>
        </div>
    );
}
