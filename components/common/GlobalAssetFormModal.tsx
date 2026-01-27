
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Loader2 } from 'lucide-react';

interface GlobalAssetFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newAsset: any) => void;
}

export default function GlobalAssetFormModal({ isOpen, onClose, onSuccess }: GlobalAssetFormModalProps) {
    const [ticker, setTicker] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState('STOCK');
    const [market, setMarket] = useState('US');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const currency = market === 'US' ? 'USD' : 'ARS'; // Default assumption

            const res = await fetch('/api/global-assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: ticker.trim().toUpperCase(),
                    name: name.trim(),
                    type,
                    market,
                    currency
                })
            });

            const data = await res.json();

            if (res.ok) {
                onSuccess(data);
                onClose();
                // Reset form
                setTicker('');
                setName('');
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error al crear activo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-400" />
                        Agregar Activo Global
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Agrega un nuevo activo al catálogo para que todos puedan usarlo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Ticker (Símbolo)</label>
                            <input
                                required
                                placeholder="Ej: KO, DIS, YPFD"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value)}
                                className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white uppercase"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Nombre de la Empresa/Fondo</label>
                            <input
                                required
                                placeholder="Ej: Coca Cola, Walt Disney"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Mercado</label>
                                <select
                                    value={market}
                                    onChange={(e) => setMarket(e.target.value)}
                                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                >
                                    <option value="US">USA (Wall St)</option>
                                    <option value="ARG">Argentina (Merval)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Tipo</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full p-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                                >
                                    <option value="STOCK">Stock (Acción)</option>
                                    <option value="ETF">ETF</option>
                                    <option value="CEDEAR">CEDEAR</option>
                                    <option value="ON">Obligación Negociable</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                type="button"
                                onClick={onClose}
                                variant="ghost"
                                className="w-full bg-red-950/30 text-red-400 hover:bg-red-900/50 hover:text-red-200 border border-red-900/30 transition-all"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                Agregar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

import { Plus } from 'lucide-react';
