
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, Database } from 'lucide-react';

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
                    setOnPrices(dataON.prices.sort((a: any, b: any) => a.ticker.localeCompare(b.ticker)));
                }

                const resUS = await fetch('/api/admin/market-data?category=US_ETF');
                const dataUS = await resUS.json();
                if (dataUS.success && dataUS.prices) {
                    setUsEtfPrices(dataUS.prices.sort((a: any, b: any) => a.ticker.localeCompare(b.ticker)));
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
                <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-slate-100 text-lg">Cotización ONs/Bonos</CardTitle>
                            <Badge variant="secondary" className="bg-slate-800 text-slate-400">Multi-Market</Badge>
                        </div>
                        <CardDescription className="text-slate-400 text-xs">
                            Cotización ONs (IOL)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        {loadingONs ? (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-yellow-500 animate-pulse">Actualizando cotizaciones...</span>
                                <span className="text-[10px] text-slate-500">Esto puede demorar unos segundos.</span>
                            </div>
                        ) : (
                            <ONListTable prices={onPrices} />
                        )}
                        {/* Manual update button removed as requested */}
                    </CardContent>
                </Card>

                {/* US ETFs Card */}
                <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-slate-100 text-lg">US ETFs/Treasuries</CardTitle>
                            <Badge variant="secondary" className="bg-slate-800 text-slate-400">Yahoo Finance</Badge>
                        </div>
                        <CardDescription className="text-slate-400 text-xs">
                            Cotización desde Yahoo Finance (Automático)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        <PriceList prices={usEtfPrices} />
                    </CardContent>
                </Card>

                {/* CEDEARs Card */}
                <CedearCard />

                {/* BCRA Control Panel */}
                <BCRAControlCard />

                {/* IPC Card */}
                <IPCCard />

                {/* UVA Card */}
                <UVACard />

                {/* TC Oficial Card */}
                <TCOficialCard />

                {/* Dolar Card */}
                <DollarCard />
            </div>
        </div>
    );
}

function BCRAControlCard() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSeed = async () => {
        setLoading(true);
        setMessage('');
        setStatus('idle');

        try {
            const res = await fetch('/api/admin/seed-economic-data', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setMessage(data.message || 'Datos históricos cargados exitosamente');
                setStatus('success');
            } else {
                setMessage(data.error || 'Error al cargar datos');
                setStatus('error');
            }
        } catch (error) {
            setMessage('Error de conexión');
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const handleScrape = async () => {
        setLoading(true);
        setMessage('');
        setStatus('idle');

        try {
            const res = await fetch('/api/admin/scrape-bcra', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setMessage(data.message || 'Datos actualizados desde BCRA');
                setStatus('success');
                // Reload page data after scraping
                setTimeout(() => window.location.reload(), 1500);
            } else {
                setMessage(data.error || 'Error al actualizar desde BCRA');
                setStatus('error');
            }
        } catch (error) {
            setMessage('Error de conexión');
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="bg-slate-900 border-slate-800 flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Control BCRA</CardTitle>
                    <Badge variant="secondary" className="bg-blue-900 text-blue-400">Admin</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Gestión de datos económicos desde BCRA
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                    <Button
                        onClick={handleSeed}
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                    >
                        <Database className="mr-2 h-4 w-4" />
                        {loading ? 'Cargando...' : 'Seed Historical Data'}
                    </Button>

                    <Button
                        onClick={handleScrape}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Actualizando...' : 'Update from BCRA'}
                    </Button>
                </div>

                {message && (
                    <div className={`p-3 rounded-md text-xs ${status === 'success'
                            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900'
                            : status === 'error'
                                ? 'bg-red-950/50 text-red-400 border border-red-900'
                                : 'bg-slate-950/50 text-slate-400 border border-slate-800'
                        }`}>
                        {status === 'success' && <CheckCircle className="inline mr-2 h-3 w-3" />}
                        {status === 'error' && <AlertCircle className="inline mr-2 h-3 w-3" />}
                        {message}
                    </div>
                )}

                <div className="text-[10px] text-slate-500 space-y-1 pt-2 border-t border-slate-800">
                    <p>• <strong>Seed</strong>: Importa ~6000 registros históricos</p>
                    <p>• <strong>Update</strong>: Obtiene últimos valores del BCRA</p>
                </div>
            </CardContent>
        </Card>
    );
}

function UVACard() {
    const [uvaData, setUvaData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/economic-data/uva')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setUvaData(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30));
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const formatValue = (val: number) => {
        return val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Valor UVA</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">BCRA</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Unidad de Valor Adquisitivo (base 31/03/2016=14.05)
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="p-4 text-center text-xs text-slate-500">Cargando...</div>
                ) : (
                    <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                        <div className="grid grid-cols-2 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                            <span>Fecha</span>
                            <span className="text-right">Valor (ARS)</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {uvaData.length > 0 ? (
                                uvaData.map((item, i) => (
                                    <div key={i} className="grid grid-cols-2 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                        <span className="text-slate-300">{new Date(item.date).toLocaleDateString('es-AR')}</span>
                                        <span className="text-right font-bold text-emerald-400">${formatValue(item.value)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-xs text-slate-500">
                                    No hay datos. Ejecuta "Seed Historical Data".
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function TCOficialCard() {
    const [tcData, setTcData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/economic-data/tc-oficial')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setTcData(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30));
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const formatValue = (val: number) => {
        return val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">TC Oficial</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">BCRA</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Tipo de Cambio Minorista ($ por USD) - Promedio vendedor
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="p-4 text-center text-xs text-slate-500">Cargando...</div>
                ) : (
                    <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                        <div className="grid grid-cols-2 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                            <span>Fecha</span>
                            <span className="text-right">TC ($/USD)</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {tcData.length > 0 ? (
                                tcData.map((item, i) => (
                                    <div key={i} className="grid grid-cols-2 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                        <span className="text-slate-300">{new Date(item.date).toLocaleDateString('es-AR')}</span>
                                        <span className="text-right font-bold text-blue-400">${formatValue(item.value)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-xs text-slate-500">
                                    No hay datos. Ejecuta "Seed Historical Data".
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
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
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Dólar Blue</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">Ambito</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Cotización histórica y scraping diario (Automático).
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                    <div className="grid grid-cols-4 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Fecha</span>
                        <span className="text-right">Compra</span>
                        <span className="text-right">Venta</span>
                        <span className="text-right">Promedio</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
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
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Inflación (IPC)</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">BCRA</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Scraping de BCRA (Automático).
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                    <div className="grid grid-cols-4 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Año</span>
                        <span>Mes</span>
                        <span className="text-right">Mensual</span>
                        <span className="text-right">Interanual</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {inflationData.length > 0 ? (
                            inflationData.map((item, i) => (
                                <div key={i} className="grid grid-cols-4 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                    <span className="text-slate-300">{item.year}</span>
                                    <span className="text-slate-500">{getMonthName(item.month)}</span>
                                    <span className="text-right font-bold text-slate-200">{item.value.toFixed(1)}%</span>
                                    <span className="text-right font-bold text-green-400">
                                        {item.interannualValue ? `${item.interannualValue.toFixed(1)}%` : '-'}
                                    </span>
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

function ONListTable({ prices }: { prices: any[] }) {
    if (!prices || prices.length === 0) return <span className="text-xs text-yellow-500">No se encontraron títulos cargados.</span>;

    return (
        <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
            <div className="grid grid-cols-4 bg-slate-900 p-2 text-[10px] font-medium text-slate-400 border-b border-slate-800">
                <span>Ticker</span>
                <span className="text-right">ARS</span>
                <span className="text-right">USD</span>
                <span className="text-right">TC Imp.</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
                {prices.map((p: any, i: number) => (
                    <div key={i} className="grid grid-cols-4 p-2 text-[10px] border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors items-center">
                        <div className="flex flex-col">
                            <span className="font-bold text-blue-400">{p.ticker}</span>
                            <span className="text-[9px] text-slate-600">{p.source === 'YAHOO' ? 'Yahoo' : 'IOL'}</span>
                        </div>
                        <span className="text-right text-slate-300">
                            {p.arsPrice ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.arsPrice) : '-'}
                        </span>
                        <span className="text-right text-green-400">
                            {p.usdPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.usdPrice) : '-'}
                        </span>
                        <span className="text-right text-yellow-500 font-mono">
                            {p.impliedTC ? `$${p.impliedTC.toFixed(2)}` : '-'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PriceList({ prices }: { prices: any[] }) {
    // This is now used for US ETFs which fall back to simple view or we can upgrade them too?
    // The US ETF API part (category=US_ETF) returns standard structure?
    // Let's check API. API returns same structure but fields might be null for arsPrice/usdPrice if not scraped dual.
    // For US ETFs (Yahoo), we usually get USD price.
    // So we can keep PriceList for US ETFs or make it generic.
    // Let's keep separate simple list for US ETFs Card.
    if (!prices || prices.length === 0) return <span className="text-xs text-yellow-500">No data.</span>;

    return (
        <div className="bg-slate-950 p-4 rounded-md border border-slate-800">
            <ul className="space-y-2">
                {prices.map((p: any, i: number) => (
                    <li key={i} className="text-xs flex justify-between items-center border-b border-slate-800 pb-1 last:border-0">
                        <span className="font-mono text-blue-400 font-bold">{p.ticker}</span>
                        <span className="text-green-400 flex items-center font-bold text-right">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(p.price || 0)}
                        </span>
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
                    setQuotes(data.data.sort((a: any, b: any) => a.ticker.localeCompare(b.ticker)));
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">CEDEARs & ETFs (Rava)</CardTitle>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400">Rava</Badge>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Cotización ARS y USD (Implícito)
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                        Cargando Rava...
                    </div>
                ) : (
                    <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                        <div className="grid grid-cols-4 bg-slate-900 p-2 text-[10px] font-medium text-slate-400 border-b border-slate-800">
                            <span>Ticker</span>
                            <span className="text-right">ARS</span>
                            <span className="text-right">USD</span>
                            <span className="text-right">TC Imp.</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
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
