
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const runAction = async (action: 'UPDATE_ONS') => {
        setLoading(action);
        setResult({ action, loading: true }); // Clear previous result but keep action context
        try {
            const res = await fetch('/api/admin/market-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            setResult(data);
        } catch (error) {
            setResult({ error: 'Failed to fetch' });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
            <h1 className="text-4xl font-bold mb-8 text-center text-slate-50">Panel de Administración</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                {/* ONs Card */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center justify-between text-lg">
                            <div className="flex items-center gap-2">
                                <span>Obligaciones Negociables</span>
                                <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded">IOL</span>
                            </div>
                            <Button
                                onClick={() => runAction('UPDATE_ONS')}
                                disabled={!!loading}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {loading === 'UPDATE_ONS' ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                                Actualizar
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-400 text-xs mb-4">
                            Obtiene precios de InvertirOnline (usando Ticker).
                        </p>
                        {result?.action === 'UPDATE_ONS' && result?.prices && (
                            <PriceList prices={result.prices} />
                        )}
                        {result?.action === 'UPDATE_ONS' && result?.error && (
                            <div className="text-red-400 mt-2 text-sm">{result.error}</div>
                        )}
                    </CardContent>
                </Card>

                {/* IPC Card */}
                <IPCCard loading={loading} setLoading={setLoading} result={result} setResult={setResult} />
            </div>
        </div>
    );
}

function IPCCard({ loading, setLoading, result, setResult }: any) {
    const [inflationData, setInflationData] = useState<any[]>([]);

    // Load data on mount
    import('react').then(({ useEffect }) => {
        useEffect(() => {
            fetch('/api/admin/inflation')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setInflationData(data);
                })
                .catch(err => console.error(err));
        }, [result]); // Reload when result changes
    });

    const updateIPC = async () => {
        setLoading('UPDATE_IPC');
        setResult(null);
        try {
            const res = await fetch('/api/admin/inflation', { method: 'POST' });
            const data = await res.json();
            setResult({ action: 'UPDATE_IPC', ...data });
        } catch (error) {
            setResult({ action: 'UPDATE_IPC', error: 'Failed to update' });
        } finally {
            setLoading(null);
        }
    };

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                        <span>Inflación (IPC)</span>
                        <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded">DatosMacro</span>
                    </div>
                    <Button
                        onClick={updateIPC}
                        disabled={!!loading}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {loading === 'UPDATE_IPC' ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                        Actualizar
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-slate-400 text-xs mb-4">
                    Scraping de datosmacro.expansion.com (Variación Mensual).
                </p>

                {result?.action === 'UPDATE_IPC' && result?.message && (
                    <div className="mb-4 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs flex items-center">
                        <CheckCircle className="w-3 h-3 mr-2" />
                        {result.message} ({result.count} registros)
                    </div>
                )}

                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-3 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Año</span>
                        <span>Mes</span>
                        <span className="text-right">Valor</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        {inflationData.length > 0 ? (
                            inflationData.map((item, i) => (
                                <div key={i} className="grid grid-cols-3 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                    <span className="text-slate-300">{item.year}</span>
                                    <span className="text-slate-500">{getMonthName(item.month)}</span>
                                    <span className="text-right font-bold text-slate-200">{item.value.toFixed(1)}%</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                                Sin datos. Pulsa actualizar.
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function getMonthName(month: number) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[month - 1] || month;
}

function PriceList({ prices }: { prices: any[] }) {
    if (!prices || prices.length === 0) return <span className="text-xs text-yellow-500">No se encontraron inversiones con Ticker.</span>;

    return (
        <div className="bg-slate-950 p-4 rounded-md border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Resultados:</h4>
            <ul className="space-y-2">
                {prices.map((p: any, i: number) => (
                    <li key={i} className="text-xs flex justify-between items-center border-b border-slate-800 pb-1 last:border-0">
                        <div className="flex flex-col">
                            <span className="font-mono text-blue-400 font-bold">{p.ticker}</span>
                            <span className="text-[10px] text-slate-500">{p.source}</span>
                        </div>
                        {p.error ? (
                            <span className="text-red-400 flex items-center text-right"><AlertCircle className="w-3 h-3 mr-1" /> {p.error}</span>
                        ) : (
                            <span className="text-green-400 flex items-center font-bold text-right">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(p.price)}
                                <CheckCircle className="w-3 h-3 ml-1" />
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
