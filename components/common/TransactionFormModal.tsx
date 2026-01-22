import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface InvestmentOption {
    id: string;
    ticker: string;
    name: string;
    currency?: string;
    type?: string;
}

interface TransactionData {
    id?: string;
    date: string;
    quantity: number;
    price: number;
    commission: number;
    currency: string;
    investmentId?: string; // For creating new
}

interface TransactionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: TransactionData | null;
    assets: InvestmentOption[];
}

export function TransactionFormModal({ isOpen, onClose, onSuccess, initialData, assets }: TransactionFormModalProps) {
    const [selectedON, setSelectedON] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [commission, setCommission] = useState('0');
    const [txCurrency, setTxCurrency] = useState<'ARS' | 'USD'>('ARS');
    const [filterType, setFilterType] = useState('ALL');
    const [submitting, setSubmitting] = useState(false);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData?.id) {
                // Edit Mode - Fetch fresh data to avoid relying on props that might be converted/incomplete
                setLoading(true);
                fetch(`/api/investments/transactions/${initialData.id}`) // Use GET (assuming endpoint supports it or I just rely on table?)
                    // Actually, GET /transactions/[id] might not exist yet. Only DELETE/PUT.
                    // Let's rely on initialData being correct OR implement GET.
                    // Given I just saw DELETE/PUT in route.ts, GET is missing.
                    // I MUST implement GET in route.ts or rely on passed data.
                    // Passed data is dangerous due to currency conversion.
                    // I will implement GET in route.ts.
                    .then(res => res.json())
                    .then(data => {
                        setSelectedON(data.investmentId);
                        setDate(new Date(data.date).toISOString().split('T')[0]);
                        setQuantity(String(data.quantity));
                        setPrice(String(data.price));
                        setCommission(String(data.commission));
                        setTxCurrency(data.currency || 'ARS');
                    })
                    .catch(err => {
                        console.error("Error fetching transaction:", err);
                        // Fallback to initialData if fetch fails?
                        if (initialData) {
                            setSelectedON(initialData.investmentId || '');
                            const d = new Date(initialData.date);
                            setDate(d.toISOString().split('T')[0]);
                            setQuantity(String(initialData.quantity));
                            setPrice(String(initialData.price));
                            setCommission(String(initialData.commission));
                            setTxCurrency((initialData.currency as 'ARS' | 'USD') || 'ARS');
                        }
                    })
                    .finally(() => setLoading(false));

            } else {
                // Create Mode - Reset
                setSelectedON('');
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setQuantity('');
                setPrice('');
                setCommission('0');
                setTxCurrency('ARS');
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        let success = false;

        try {
            const isEdit = !!initialData?.id;
            const url = isEdit
                ? `/api/investments/transactions/${initialData.id}`
                : `/api/investments/on/${selectedON}/transactions`;

            const method = isEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    quantity,
                    price,
                    commission,
                    currency: txCurrency
                })
            });

            if (!res.ok) throw new Error('Failed to save transaction');
            success = true;
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('Error al guardar la transacción');
        } finally {
            setSubmitting(false);
        }

        if (success) {
            onSuccess();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">{initialData ? 'Editar Compra' : 'Nueva Compra'}</CardTitle>
                    <CardDescription className="text-slate-400">
                        {initialData ? 'Modifica los detalles de la operación' : 'Registra una nueva operación de compra'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Tipo de Activo</label>
                            <select
                                className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white mb-4"
                                disabled={!!initialData}
                                onChange={(e) => {
                                    // Reset selected ON when type changes
                                    setSelectedON('');
                                    // Filter logic handled in render or derived state?
                                    // Better to just store the type filter state
                                    setFilterType(e.target.value);
                                }}
                                value={filterType}
                            >
                                <option value="ALL">Todos</option>
                                <option value="ON">Obligaciones Negociables</option>
                                <option value="CEDEAR">CEDEARs</option>
                            </select>

                            <label className="text-sm font-medium text-slate-300">Activo / Ticker</label>
                            <select
                                required
                                disabled={!!initialData} // Disable changing asset on edit
                                value={selectedON}
                                onChange={(e) => setSelectedON(e.target.value)}
                                className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white disabled:opacity-50"
                            >
                                <option value="">Seleccionar...</option>
                                {assets
                                    .filter(a => filterType === 'ALL' || (a.type === filterType) || (filterType === 'ON' && !a.type)) // Default to ON if no type? Or loose match
                                    .sort((a, b) => a.ticker.localeCompare(b.ticker))
                                    .map(asset => (
                                        <option key={asset.id} value={asset.id}>
                                            {asset.ticker} - {asset.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Moneda Ope.</label>
                                <div className="flex bg-slate-800 rounded-md border border-slate-700 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setTxCurrency('ARS')}
                                        className={`flex-1 text-xs py-1.5 rounded font-bold transition-colors ${txCurrency === 'ARS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        ARS
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTxCurrency('USD')}
                                        className={`flex-1 text-xs py-1.5 rounded font-bold transition-colors ${txCurrency === 'USD' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        USD
                                    </button>
                                </div>
                            </div>
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
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Cantidad</label>
                                <input
                                    type="number"
                                    required
                                    min="0.000001"
                                    step="any"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Precio ({txCurrency})</label>
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
                            <label className="text-sm font-medium text-slate-300">Comisión ({txCurrency})</label>
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
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {submitting ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
