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

interface GlobalCatalogTabProps {
    excludeMarket?: string;
    includeMarket?: string;
}

export function GlobalCatalogTab({ excludeMarket, includeMarket }: GlobalCatalogTabProps) {
    const [assets, setAssets] = useState<GlobalAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [addingId, setAddingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAssets();
    }, []);

    // Filter assets logic
    const filteredAssets = assets.filter(asset => {
        if (excludeMarket && asset.market === excludeMarket) return false;
        if (includeMarket && asset.market !== includeMarket) return false;
        return true;
    });

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadAssets(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // ... (rest of render uses filteredAssets)

    // ... inside render:
    <div className="space-y-8">
        {Object.entries(filteredAssets.reduce((acc, asset) => {
            const type = asset.type || 'Otros';
            if (!acc[type]) acc[type] = [];
            acc[type].push(asset);
            return acc;
        }, {} as Record<string, GlobalAsset[]>)).sort((a, b) => a[0].localeCompare(b[0])).map(([type, typeAssets]) => (

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
        headers: {'Content-Type': 'application/json' },
        body: JSON.stringify({assetId: asset.id })
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
                        <div className="space-y-8">
                            {Object.entries(assets.filter(a => a.market !== 'US').reduce((acc, asset) => {
                                const type = asset.type || 'Otros';
                                if (!acc[type]) acc[type] = [];
                                acc[type].push(asset);
                                return acc;
                            }, {} as Record<string, GlobalAsset[]>)).sort((a, b) => a[0].localeCompare(b[0])).map(([type, typeAssets]) => (
                                <div key={type} className="bg-slate-900/30 rounded-lg p-4 border border-slate-800">
                                    <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" />
                                        {type === 'CORPORATE_BOND' ? 'Obligaciones Negociables' : type}
                                        <Badge variant="secondary" className="ml-2 bg-slate-800 text-slate-400 border-none">
                                            {typeAssets.length}
                                        </Badge>
                                    </h3>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500 font-medium">
                                                    <th className="pb-3 pl-2">Ticker</th>
                                                    <th className="pb-3">Nombre</th>
                                                    <th className="pb-3 text-right">Precio</th>
                                                    <th className="pb-3 text-center">Moneda</th>
                                                    <th className="pb-3 text-right pr-2">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {typeAssets.map((asset) => (
                                                    <tr key={asset.id} className="group hover:bg-slate-800/30 transition-colors">
                                                        <td className="py-3 pl-2 font-mono font-bold text-white">
                                                            {asset.ticker}
                                                        </td>
                                                        <td className="py-3 text-slate-300 text-sm">
                                                            {asset.name}
                                                        </td>
                                                        <td className="py-3 text-right text-slate-200 font-mono">
                                                            {asset.lastPrice
                                                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: asset.currency }).format(asset.lastPrice)
                                                                : '-'}
                                                        </td>
                                                        <td className="py-3 text-center">
                                                            <Badge variant="outline" className={`border-none ${asset.currency === 'USD' ? 'text-green-400 bg-green-900/20' : 'text-blue-400 bg-blue-900/20'}`}>
                                                                {asset.currency}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 text-right pr-2">
                                                            {asset.inPortfolio ? (
                                                                <span className="text-xs font-medium text-emerald-500 flex items-center justify-end gap-1">
                                                                    <Check className="h-3 w-3" /> En cartera
                                                                </span>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                                                                    onClick={() => addToPortfolio(asset)}
                                                                    disabled={addingId === asset.id}
                                                                >
                                                                    {addingId === asset.id ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <Plus className="h-3 w-3" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}

                            {assets.length === 0 && !loading && (
                                <div className="text-center py-12 text-slate-500 italic">
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
