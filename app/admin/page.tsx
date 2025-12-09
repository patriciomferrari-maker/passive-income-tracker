
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const runAction = async (action: 'UPDATE_PRICES' | 'UPDATE_IPC') => {
        setLoading(action);
        setResult(null);
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
        <div className="grid gap-6 md:grid-cols-2">
            {/* Asset Prices Card */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-100 flex items-center justify-between">
                        Precios de Activos
                        <Button
                            onClick={() => runAction('UPDATE_PRICES')}
                            disabled={!!loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading === 'UPDATE_PRICES' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Actualizar Precios
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-sm mb-4">
                        Consulta Yahoo Finance para todos los activos que tengan un "Ticker" asignado (ej: MGC9O.BA, ^TNX).
                    </p>
                    {result?.prices && (
                        <div className="bg-slate-950 p-4 rounded-md border border-slate-800">
                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Resultados:</h4>
                            <ul className="space-y-2">
                                {result.prices.map((p: any, i: number) => (
                                    <li key={i} className="text-xs flex justify-between items-center border-b border-slate-800 pb-1 last:border-0">
                                        <span className="font-mono text-blue-400">{p.ticker}</span>
                                        {p.error ? (
                                            <span className="text-red-400 flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> {p.error}</span>
                                        ) : (
                                            <span className="text-green-400 flex items-center">{p.price} {p.currency} <CheckCircle className="w-3 h-3 ml-1" /></span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {result.prices.length === 0 && <span className="text-xs text-yellow-500">No se encontraron inversiones con Ticker.</span>}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* IPC Card */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-100 flex items-center justify-between">
                        Inflación (IPC)
                        <Button
                            onClick={() => runAction('UPDATE_IPC')}
                            disabled={!!loading}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {loading === 'UPDATE_IPC' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Consultar datos.gob.ar
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 text-sm mb-4">
                        Consulta la API de Datos Argentina para obtener el último valor del IPC Nacional.
                    </p>
                    {result?.ipc && (
                        <div className="bg-slate-950 p-4 rounded-md border border-slate-800">
                            {result.ipc.error ? (
                                <p className="text-red-400 text-sm">{result.ipc.error}</p>
                            ) : (
                                <div>
                                    <p className="text-slate-400 text-xs">Fecha: <span className="text-slate-200">{new Date(result.ipc.date).toLocaleDateString()}</span></p>
                                    <p className="text-slate-400 text-xs">Valor: <span className="text-slate-200 font-bold">{result.ipc.value}</span></p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
