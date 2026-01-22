
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface InvestmentOption {
    id: string;
    ticker: string;
    name: string;
    type?: string;
}

interface RegisterSaleModalProps {
    assets: InvestmentOption[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function RegisterSaleModal({ assets, onClose, onSuccess }: RegisterSaleModalProps) {
    const [selectedAsset, setSelectedAsset] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState(''); // Sell Price
    const [commission, setCommission] = useState('0');
    const [currency, setCurrency] = useState('ARS'); // Default to ARS
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const asset = assets.find(a => a.id === selectedAsset);
            const isBond = asset?.type === 'ON' || asset?.type === 'CORPORATE_BOND';
            const priceDivisor = isBond ? 100 : 1;

            const rawPrice = Number(price);
            const actualPrice = rawPrice / priceDivisor;

            const res = await fetch(`/api/investments/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    investmentId: selectedAsset,
                    date,
                    quantity: Number(quantity),
                    price: actualPrice,
                    commission: Number(commission),
                    type: 'SELL',
                    currency
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to register sale');
            }

            onSuccess();
        } catch (error) {
            console.error('Error registering sale:', error);
            alert('Error al registrar la venta');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-700 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        Registrar Venta
                        <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-800">SELL</span>
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Esta operación reducirá tus tenencias y generará un evento fiscal (FIFO).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Activo a Vender</label>
                            <select
                                required
                                value={selectedAsset}
                                onChange={(e) => setSelectedAsset(e.target.value)}
                                className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-red-500/50 outline-none"
                            >
                                <option value="">Seleccionar Activo...</option>
                                {assets.map(asset => (
                                    <option key={asset.id} value={asset.id}>
                                        {asset.ticker} - {asset.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Moneda Venta</label>
                                <div className="flex bg-slate-800 rounded-md border border-slate-700 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setCurrency('ARS')}
                                        className={`flex-1 text-xs py-1.5 rounded font-bold transition-colors ${currency === 'ARS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        ARS
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrency('USD')}
                                        className={`flex-1 text-xs py-1.5 rounded font-bold transition-colors ${currency === 'USD' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        USD
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Fecha Venta</label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Cantidad Nominal</label>
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Precio ({currency})</label>
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
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Comisión ({currency})</label>
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

                        <div className="flex gap-4 pt-4">
                            <Button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white border-none"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-red-600 hover:bg-red-700 text-white"
                            >
                                {submitting ? 'Registrando...' : 'Confirmar Venta'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
