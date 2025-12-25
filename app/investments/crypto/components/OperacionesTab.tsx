'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { POPULAR_CRYPTOS, getCryptoIcon } from '@/app/lib/crypto-list';

interface Crypto {
    id: string;
    ticker: string;
    name: string;
    transactions: Transaction[];
}

interface Transaction {
    id: string;
    date: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    commission: number;
    totalAmount: number;
    notes?: string;
}

export default function OperacionesTab() {
    const [cryptos, setCryptos] = useState<Crypto[]>([]);
    const [showNewCryptoForm, setShowNewCryptoForm] = useState(false);
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [selectedCryptoId, setSelectedCryptoId] = useState('');
    const [loading, setLoading] = useState(true);
    const [fetchingPrice, setFetchingPrice] = useState(false);

    // Form states
    const [cryptoFormMode, setCryptoFormMode] = useState<'select' | 'custom'>('select');
    const [selectedCrypto, setSelectedCrypto] = useState('');
    const [cryptoForm, setCryptoForm] = useState({ ticker: '', name: '', lastPrice: '' });

    const [txForm, setTxForm] = useState({
        type: 'BUY' as 'BUY' | 'SELL',
        quantity: '',
        price: '',
        commission: '0',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

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

    const handleCryptoSelection = async (coingeckoId: string) => {
        setSelectedCrypto(coingecko Id);
        const crypto = POPULAR_CRYPTOS.find(c => `${c.symbol}-${c.coingeckoId}` === coingeckoId);
        if (crypto) {
            setCryptoForm({
                ticker: crypto.symbol,
                name: crypto.name,
                lastPrice: ''
            });

            // Fetch current price
            setFetchingPrice(true);
            try {
                const res = await fetch(`/api/crypto/prices/${crypto.symbol}`);
                if (res.ok) {
                    const data = await res.json();
                    setCryptoForm(prev => ({ ...prev, lastPrice: data.price.toString() }));
                }
            } catch (error) {
                console.error('Error fetching price:', error);
            } finally {
                setFetchingPrice(false);
            }
        }
    };

    const handleCreateCrypto = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/investments/crypto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: cryptoForm.ticker.toUpperCase(),
                    name: cryptoForm.name,
                    lastPrice: parseFloat(cryptoForm.lastPrice) || 0
                })
            });

            if (res.ok) {
                setCryptoForm({ ticker: '', name: '', lastPrice: '' });
                setSelectedCrypto('');
                setCryptoFormMode('select');
                setShowNewCryptoForm(false);
                fetchCryptos();
            }
        } catch (error) {
            console.error('Error creating crypto:', error);
        }
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/investments/crypto/${selectedCryptoId}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: txForm.type,
                    quantity: parseFloat(txForm.quantity),
                    price: parseFloat(txForm.price),
                    commission: parseFloat(txForm.commission),
                    date: txForm.date,
                    notes: txForm.notes
                })
            });

            if (res.ok) {
                setTxForm({
                    type: 'BUY',
                    quantity: '',
                    price: '',
                    commission: '0',
                    date: new Date().toISOString().split('T')[0],
                    notes: ''
                });
                setShowTransactionForm(false);
                setSelectedCryptoId('');
                fetchCryptos();
            }
        } catch (error) {
            console.error('Error adding transaction:', error);
        }
    };

    // Get all transactions from all cryptos, sorted by date
    const allTransactions = cryptos.flatMap(crypto =>
        crypto.transactions.map(tx => ({
            ...tx,
            cryptoTicker: crypto.ticker,
            cryptoName: crypto.name
        }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (loading) {
        return <div className="text-center text-slate-400">Cargando...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex gap-4">
                <Button
                    onClick={() => setShowNewCryptoForm(!showNewCryptoForm)}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Crypto
                </Button>
                <Button
                    onClick={() => setShowTransactionForm(!showTransactionForm)}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={cryptos.length === 0}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Operación
                </Button>
                <Button
                    onClick={() => window.open('/api/crypto/export', '_blank')}
                    variant="outline"
                    disabled={cryptos.length === 0}
                >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                </Button>
            </div>

            {/* New Crypto Form */}
            {showNewCryptoForm && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Añadir Nueva Criptomoneda</h3>

                    {/* Mode Selection */}
                    <div className="mb-4 flex gap-2">
                        <Button
                            type="button"
                            variant={cryptoFormMode === 'select' ? 'default' : 'outline'}
                            onClick={() => setCryptoFormMode('select')}
                            size="sm"
                        >
                            Lista predefinida
                        </Button>
                        <Button
                            type="button"
                            variant={cryptoFormMode === 'custom' ? 'default' : 'outline'}
                            onClick={() => setCryptoFormMode('custom')}
                            size="sm"
                        >
                            Custom
                        </Button>
                    </div>

                    <form onSubmit={handleCreateCrypto} className="space-y-4">
                        {cryptoFormMode === 'select' ? (
                            <>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Seleccionar Criptomoneda</label>
                                    <select
                                        value={selectedCrypto}
                                        onChange={(e) => handleCryptoSelection(e.target.value)}
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2"
                                    >
                                        <option value="">Seleccionar...</option>
                                        {POPULAR_CRYPTOS.map(crypto => (
                                            <option key={crypto.coingeckoId} value={`${crypto.symbol}-${crypto.coingeckoId}`}>
                                                {getCryptoIcon(crypto.symbol)} {crypto.symbol} - {crypto.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {selectedCrypto && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Ticker</label>
                                            <Input
                                                value={cryptoForm.ticker}
                                                disabled
                                                className="bg-slate-800 border-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Nombre</label>
                                            <Input
                                                value={cryptoForm.name}
                                                disabled
                                                className="bg-slate-800 border-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">
                                                Precio Actual {fetchingPrice && <Loader2 className="inline h-3 w-3 animate-spin" />}
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={cryptoForm.lastPrice}
                                                onChange={(e) => setCryptoForm({ ...cryptoForm, lastPrice: e.target.value })}
                                                placeholder="0.00"
                                                className="bg-slate-800 border-slate-700"
                                                disabled={fetchingPrice}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Ticker</label>
                                    <Input
                                        value={cryptoForm.ticker}
                                        onChange={(e) => setCryptoForm({ ...cryptoForm, ticker: e.target.value })}
                                        placeholder="BTC"
                                        required
                                        className="bg-slate-800 border-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Nombre</label>
                                    <Input
                                        value={cryptoForm.name}
                                        onChange={(e) => setCryptoForm({ ...cryptoForm, name: e.target.value })}
                                        placeholder="Bitcoin"
                                        required
                                        className="bg-slate-800 border-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Precio Inicial</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={cryptoForm.lastPrice}
                                        onChange={(e) => setCryptoForm({ ...cryptoForm, lastPrice: e.target.value })}
                                        placeholder="0.00"
                                        className="bg-slate-800 border-slate-700"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button type="submit" disabled={!cryptoForm.ticker || !cryptoForm.name}>
                                Crear
                            </Button>
                            <Button type="button" variant="outline" onClick={() => {
                                setShowNewCryptoForm(false);
                                setCryptoFormMode('select');
                                setSelectedCrypto('');
                                setCryptoForm({ ticker: '', name: '', lastPrice: '' });
                            }}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* New Transaction Form */}
            {showTransactionForm && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Nueva Operación</h3>
                    <form onSubmit={handleAddTransaction} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Crypto</label>
                                <select
                                    value={selectedCryptoId}
                                    onChange={(e) => setSelectedCryptoId(e.target.value)}
                                    required
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2"
                                >
                                    <option value="">Seleccionar...</option>
                                    {cryptos.map(crypto => (
                                        <option key={crypto.id} value={crypto.id}>
                                            {getCryptoIcon(crypto.ticker)} {crypto.ticker} - {crypto.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Tipo</label>
                                <select
                                    value={txForm.type}
                                    onChange={(e) => setTxForm({ ...txForm, type: e.target.value as 'BUY' | 'SELL' })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2"
                                >
                                    <option value="BUY">Compra</option>
                                    <option value="SELL">Venta</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Cantidad</label>
                                <Input
                                    type="number"
                                    step="0.00000001"
                                    value={txForm.quantity}
                                    onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                                    placeholder="0.00"
                                    required
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Precio</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={txForm.price}
                                    onChange={(e) => setTxForm({ ...txForm, price: e.target.value })}
                                    placeholder="0.00"
                                    required
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Comisión</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={txForm.commission}
                                    onChange={(e) => setTxForm({ ...txForm, commission: e.target.value })}
                                    placeholder="0.00"
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Fecha</label>
                                <Input
                                    type="date"
                                    value={txForm.date}
                                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                                    required
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Notas (opcional)</label>
                            <Input
                                value={txForm.notes}
                                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                                placeholder="Notas adicionales..."
                                className="bg-slate-800 border-slate-700"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button type="submit">Guardar</Button>
                            <Button type="button" variant="outline" onClick={() => setShowTransactionForm(false)}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Transactions List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4">Historial de Operaciones</h3>
                {allTransactions.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No hay operaciones registradas</p>
                ) : (
                    <div className="space-y-2">
                        {allTransactions.map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                                <div className="flex items-center gap-4">
                                    {tx.type === 'BUY' ? (
                                        <ArrowUpCircle className="h-6 w-6 text-green-400" />
                                    ) : (
                                        <ArrowDownCircle className="h-6 w-6 text-red-400" />
                                    )}
                                    <div>
                                        <div className="font-semibold flex items-center gap-2">
                                            <span>{getCryptoIcon(tx.cryptoTicker)}</span>
                                            {tx.cryptoTicker}
                                        </div>
                                        <div className="text-sm text-slate-400">{new Date(tx.date).toLocaleDateString('es-AR')}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono">
                                        {tx.quantity} × ${tx.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className={`text-sm font-semibold ${tx.type === 'BUY' ? 'text-red-400' : 'text-green-400'}`}>
                                        {tx.type === 'BUY' ? '-' : '+'}${Math.abs(tx.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
