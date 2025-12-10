
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminPage() {
    // ONs State
    const [onPrices, setOnPrices] = useState<any[]>([]);
    const [usEtfPrices, setUsEtfPrices] = useState<any[]>([]); // New state for US ETFs
    const [loadingONs, setLoadingONs] = useState(true);

    // Fetch ONs on mount
    useEffect(() => {
        async function initAdmin() {
            setLoadingONs(true);
            try {
                // 1. Trigger Updates (Auto-update requested by user)
                // We fire both updates in parallel for efficiency
                await Promise.all([
                    fetch('/api/admin/market-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'UPDATE_ONS' })
                    }),
                    fetch('/api/admin/market-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'UPDATE_TREASURIES' })
                    })
                ]);

                // 2. Fetch Latest Data
                const resON = await fetch('/api/admin/market-data?category=ON');
                const dataON = await resON.json();
                if (dataON.success && dataON.prices) {
                    setOnPrices(dataON.prices);
                }

                const resUS = await fetch('/api/admin/market-data?category=US_ETF');
                const dataUS = await resUS.json();
                if (dataUS.success && dataUS.prices) {
                    setUsEtfPrices(dataUS.prices);
                }
            } catch (e) {
                console.error("Failed to update/load assets", e);
            } finally {
                setLoadingONs(false);
            }
        }
        initAdmin();
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
            <h1 className="text-4xl font-bold mb-8 text-center text-slate-50">Panel de Administración</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {/* ONs Card */}
                <Card className="bg-slate-900 border-slate-800 h-fit">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-slate-100 text-lg">Cotización ONs/Bonos</CardTitle>
                            <Badge variant="secondary" className="bg-slate-800 text-slate-400">Multi-Market</Badge>
                        </div>
                        <CardDescription className="text-slate-400 text-xs">
                            Cotización ONs (IOL)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingONs ? (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-yellow-500 animate-pulse">Actualizando cotizaciones...</span>
                                <span className="text-[10px] text-slate-500">Esto puede demorar unos segundos.</span>
                            </div>
                        ) : (
                            <PriceList prices={onPrices} />
                        )}
                        {/* Manual update button removed as requested */}
                    </CardContent>
                </Card>

                {/* US ETFs Card */}
                <Card className="bg-slate-900 border-slate-800 h-fit">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-slate-100 text-lg">US ETFs/Treasuries</CardTitle>
                            <Badge variant="secondary" className="bg-slate-800 text-slate-400">Yahoo Finance</Badge>
                        </div>
                        <CardDescription className="text-slate-400 text-xs">
                            Cotización desde Yahoo Finance (Automático)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PriceList prices={usEtfPrices} />
                    </CardContent>
                </Card>

                {/* CEDEARs Card */}
                <CedearCard />

                {/* IPC Card */}
                <IPCCard />

                {/* Dolar Card */}
                <DollarCard />
            </div>
        </div>
    );
}

function DollarCard() {
    const [dollarData, setDollarData] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/admin/economic')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setDollarData(data);
            })
            .catch(err => console.error(err));
    }, []);

    return (
        <Card className="bg-slate-900 border-slate-800 h-fit">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Dólar Blue</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">Ambito</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Cotización histórica y scraping diario (Automático).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-4 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Fecha</span>
                        <span className="text-right">Compra</span>
                        <span className="text-right">Venta</span>
                        <span className="text-right">Promedio</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        {dollarData.length > 0 ? (
                            dollarData.map((item, i) => (
                                <div key={i} className="grid grid-cols-4 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                    <span className="text-slate-300">{new Date(item.date).toLocaleDateString('es-AR')}</span>
                                    <span className="text-right text-slate-400">${item.buyRate}</span>
                                    <span className="text-right font-bold text-green-400">${item.sellRate}</span>
                                    <span className="text-right font-bold text-blue-400">${item.value}</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                                Cargando...
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function IPCCard() {
    const [inflationData, setInflationData] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/admin/inflation')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setInflationData(data);
            })
            .catch(err => console.error(err));
    }, []);

    return (
        <Card className="bg-slate-900 border-slate-800 h-fit">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Inflación (IPC)</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">DatosMacro</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Scraping de datosmacro.expansion.com (Automático).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-3 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Año</span>
                        <span>Mes</span>
                        <span className="text-right">Valor</span>
                    </div>
                    <div>
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
                                Cargando...
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
    if (!prices || prices.length === 0) return <span className="text-xs text-yellow-500">No se encontraron títulos cargados para obtener el valor.</span>;

    return (
        <div className="bg-slate-950 p-4 rounded-md border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Resultados:</h4>
            <ul className="space-y-2">
                {prices.map((p: any, i: number) => (
                    <li key={i} className="text-xs flex justify-between items-center border-b border-slate-800 pb-1 last:border-0">
                        <div className="flex flex-col">
                            <span className="font-mono text-blue-400 font-bold">{p.ticker}</span>
                            <span className="text-[10px] text-slate-500">
                                {['TREASURY', 'ETF', 'STOCK'].includes(p.type) ? 'Yahoo Finance' : 'IOL'}
                            </span>
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

function CedearCard() {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/cedears')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.data)) {
                    setQuotes(data.data);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Card className="bg-slate-900 border-slate-800 h-fit">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">CEDEARs & ETFs (Rava)</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">Rava</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Cotización ARS y USD (Implícito)
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                        Cargando Rava...
                    </div>
                ) : (
                    <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
                        <div className="grid grid-cols-4 bg-slate-900 p-2 text-[10px] font-medium text-slate-400 border-b border-slate-800">
                            <span>Ticker</span>
                            <span className="text-right">ARS</span>
                            <span className="text-right">USD</span>
                            <span className="text-right">TC Imp.</span>
                        </div>
                        <div>
                            {quotes.length > 0 ? (
                                quotes.map((q, i) => (
                                    <div key={i} className="grid grid-cols-4 p-2 text-[10px] border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors items-center">
                                        <span className="font-bold text-blue-400">{q.ticker}</span>
                                        <span className="text-right text-slate-300">
                                            {q.arsPrice ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(q.arsPrice) : '-'}
                                        </span>
                                        <span className="text-right text-green-400">
                                            {q.usdPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(q.usdPrice) : '-'}
                                        </span>
                                        <span className="text-right text-yellow-500 font-mono">
                                            {q.tc ? `$${q.tc.toFixed(2)}` : '-'}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-xs text-slate-500">
                                    No hay CEDEARs/ETFs cargados.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
