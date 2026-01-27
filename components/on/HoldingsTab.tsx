'use client';

import { useState, useEffect } from 'react';
import PositionsTable from '@/components/common/PositionsTable';
import { TransactionFormModal } from '@/components/common/TransactionFormModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Filter } from 'lucide-react';

interface ON {
    id: string;
    ticker: string;
    description: string;
    type?: string;
}

export function HoldingsTab({ market = 'ARG' }: { market?: string }) {
    const [viewCurrency, setViewCurrency] = useState<'ARS' | 'USD'>('USD');
    const [viewType, setViewType] = useState<string>('ALL'); // ALL, ON, CEDEAR, ETF
    const [assets, setAssets] = useState<any[]>([]);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch assets for the modal
    useEffect(() => {
        // Fetch Assets
        fetch(`/api/investments/on?market=${market}&t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                const formatted = data.map((item: any) => ({
                    id: item.id,
                    ticker: item.ticker,
                    name: item.description || item.name,
                    type: item.type
                }));
                setAssets(formatted);
            })
            .catch(err => console.error('Error fetching assets:', err));

        // Auto-Sync Prices (Optimistic, don't block render)
        fetch('/api/investments/sync', { method: 'POST' })
            .then(() => setRefreshTrigger(prev => prev + 1))
            .catch(err => console.error('Error syncing prices:', err));

    }, []);

    const handleEditPosition = (positionId: string) => {
        setEditingTransactionId(positionId);
        setIsEditModalOpen(true);
    };

    const handleSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setEditingTransactionId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                            Tenencia
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Resumen de posiciones actuales y rendimiento
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
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
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <PositionsTable
                        types={viewType === 'ALL' ? undefined : viewType}
                        market={market}
                        currency={viewCurrency}
                        refreshTrigger={refreshTrigger}
                        onEdit={handleEditPosition}
                    />
                </CardContent>
            </Card>

            <TransactionFormModal
                isOpen={isEditModalOpen}
                onClose={handleCloseModal}
                onSuccess={handleSuccess}
                initialData={editingTransactionId ? {
                    id: editingTransactionId,
                    date: '', // Will be fetched
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
