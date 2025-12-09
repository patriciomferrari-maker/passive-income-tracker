
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const runAction = async (action: 'UPDATE_TREASURIES' | 'UPDATE_ONS' | 'UPDATE_IPC') => {
        setLoading(action);
        setResult(null);
        try {
            const res = await fetch('/api/admin/market-data', {
                method: 'POST',
```typescript
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
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
            <h1 className="text-4xl font-bold mb-8 text-center text-slate-50">Panel de Administración</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">


                {/* ONs Card - PRIMARY FOCUS */}
                <Card className="bg-slate-900 border-slate-800 md:col-span-2 lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center justify-between text-lg">
                            Obligaciones Negociables (IOL)
                            <Button 
                                onClick={() => runAction('UPDATE_ONS')} 
                                disabled={!!loading}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                            >
                                {loading === 'UPDATE_ONS' ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <RefreshCw className="mr-2 h-3 w-3"/>}
                                Actualizar ONs (Scraping)
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-400 text-xs mb-4">
                            Obtiene precios de InvertirOnline (usando Ticker sin .BA).
                        </p>
                        {result?.prices && loading !== 'UPDATE_ONS' && (
                            <PriceList prices={result.prices} />
                        )}
                        {result?.error && (
                            <div className="text-red-400 mt-2">{result.error}</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function PriceList({ prices }: { prices: any[] }) {
    if (!prices || prices.length === 0) return <span className="text-xs text-yellow-500">No se encontraron inversiones con Ticker.</span>;

    return (
        <div className="bg-slate-950 p-4 rounded-md border border-slate-800 max-h-60 overflow-y-auto">
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
```
