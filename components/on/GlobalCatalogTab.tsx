'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Globe, Plus, Check, Loader2, DollarSign, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GlobalAsset {
    id: string;
    ticker: string;
    name: string;
    type: string;
    currency: string;
    market: string;
    lastPrice: number;
    inPortfolio: boolean;
}

export function GlobalCatalogTab() {
    const [assets, setAssets] = useState<GlobalAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [addingId, setAddingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAssets();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssets(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const loadAssets = async (query: string = '') => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.append('search', query);

            const res = await fetch(`/api/global-assets?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAssets(data);
            } else {
                const text = await res.text();
                // Try to parse error json
                try {
                    const json = JSON.parse(text);
                    setError(`Error: ${json.error || res.statusText}`);
                } catch {
                    setError(`Error ${res.status}: ${res.statusText}`);
                }
            }
        } catch (error) {
            console.error('Error loading assets:', error);
            setError('Error de conexión al cargar activos.');
        } finally {
            setLoading(false);
        }
    };

    const addToPortfolio = async (asset: GlobalAsset) => {
        setAddingId(asset.id);
        try {
            const res = await fetch('/api/user-holdings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId: asset.id })
            });

            if (res.ok) {
                // Update local state
                setAssets(prev => prev.map(a =>
                    a.id === asset.id ? { ...a, inPortfolio: true } : a
                ));
            } else {
                throw new Error('Failed to add');
            }
        } catch (error) {
            console.error("Failed to add asset:", error);
            alert("No se pudo agregar el activo. Intenta nuevamente.");
        } finally {
            setAddingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Globe className="text-blue-400" />
                                Catálogo Global
                            </h2>
                            <p className="text-slate-400">
                                Explora y agrega CEDEARs, ETFs y otros activos a tu cartera.
                            </p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                            <Input
                                placeholder="Buscar por ticker o nombre..."
                                className="pl-10 bg-slate-900 border-slate-700 text-white"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200">
                            {error}
                        </div>
                    )}

                    {loading && !assets.length ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-blue-400 h-8 w-8" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assets.map((asset) => (
                                <div
                                    key={asset.id}
                                    className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-blue-500/30 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-white">{asset.ticker}</h3>
                                                <Badge variant="outline" className="text-slate-400 border-slate-700">
                                                    {asset.type}
                                                </Badge>
                                                {asset.currency === 'USD' && (
                                                    <Badge className="bg-green-900/30 text-green-400 border-green-900 hover:bg-green-900/30">
                                                        USD
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400 line-clamp-1 mt-1" title={asset.name}>
                                                {asset.name}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-medium text-white">
                                                {asset.lastPrice
                                                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: asset.currency }).format(asset.lastPrice)
                                                    : '-'
                                                }
                                            </p>
                                            <p className="text-xs text-slate-500">{asset.market}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        {asset.inPortfolio ? (
                                            <Button
                                                className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 cursor-default"
                                                variant="outline"
                                            >
                                                <Check className="mr-2 h-4 w-4" /> En Portfolio
                                            </Button>
                                        ) : (
                                            <Button
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={() => addToPortfolio(asset)}
                                                disabled={addingId === asset.id}
                                            >
                                                {addingId === asset.id ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Plus className="mr-2 h-4 w-4" />
                                                )}
                                                Agregar a Portfolio
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {assets.length === 0 && !loading && (
                                <div className="col-span-full text-center py-12 text-slate-500">
                                    No se encontraron activos que coincidan con tu búsqueda.
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
