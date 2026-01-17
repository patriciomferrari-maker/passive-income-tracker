
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { AlertCircle, CheckCircle, RefreshCw, Database, Users, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
                {/* Users Management */}
                <UsersCard />

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
                    <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-emerald-900 text-emerald-400">Auto</Badge>
                        <Badge variant="secondary" className="bg-slate-800 text-slate-400">BCRA</Badge>
                    </div>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Actualización automática diaria. Base 31/03/2016=14.05
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
                    <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-emerald-900 text-emerald-400">Auto</Badge>
                        <Badge variant="secondary" className="bg-slate-800 text-slate-400">BCRA</Badge>
                    </div>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Actualización automática diaria. Promedio vendedor
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
    const [loading, setLoading] = useState(false);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newIPCDate, setNewIPCDate] = useState('');
    const [newIPCValue, setNewIPCValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
    const fetchedRef = useRef(false);

    const fetchIPCData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/ipc?limit=24');
            const data = await res.json();
            if (data.success && Array.isArray(data.indicators)) {
                setInflationData(data.indicators);
            }
        } catch (err) {
            console.error('[IPCCard] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchIPCData();
    }, []);

    const handleAddIPC = async () => {
        if (!newIPCDate || !newIPCValue) {
            setMessage('Por favor completa todos los campos');
            setMessageType('error');
            return;
        }

        const valueNum = parseFloat(newIPCValue);
        if (isNaN(valueNum)) {
            setMessage('El valor debe ser un número válido');
            setMessageType('error');
            return;
        }

        setSaving(true);
        setMessage('');
        setMessageType('');

        try {
            const res = await fetch('/api/admin/ipc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: newIPCDate,
                    value: valueNum / 100 // Convert percentage to decimal
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage(`${data.message}. ${data.affectedContracts} contratos afectados. ${data.reminder}`);
                setMessageType('success');
                setNewIPCDate('');
                setNewIPCValue('');
                setAddDialogOpen(false);
                // Refresh data
                fetchIPCData();
            } else {
                setMessage(data.error || 'Error al guardar IPC');
                setMessageType('error');
            }
        } catch (error: any) {
            setMessage('Error de conexión: ' + error.message);
            setMessageType('error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Inflación (IPC)</CardTitle>
                    <div className="flex gap-2">
                        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs">
                                    + Agregar IPC
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-950 border-slate-800 text-slate-100">
                                <DialogHeader>
                                    <DialogTitle>Agregar/Editar IPC Mensual</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Mes/Año</Label>
                                        <Input
                                            type="month"
                                            value={newIPCDate}
                                            onChange={(e) => setNewIPCDate(e.target.value)}
                                            className="bg-slate-900 border-slate-700"
                                        />
                                        <p className="text-[10px] text-slate-500">
                                            Selecciona el mes para el cual quieres ingresar el IPC
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>IPC Mensual (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 2.5"
                                            value={newIPCValue}
                                            onChange={(e) => setNewIPCValue(e.target.value)}
                                            className="bg-slate-900 border-slate-700"
                                        />
                                        <p className="text-[10px] text-slate-500">
                                            Ingresa el porcentaje mensual (ej: 2.5 para 2.5%)
                                        </p>
                                    </div>
                                    {message && (
                                        <div className={`p-3 rounded-md text-xs ${messageType === 'success'
                                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900'
                                                : 'bg-red-950/50 text-red-400 border border-red-900'
                                            }`}>
                                            {message}
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleAddIPC}
                                        disabled={saving}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar IPC'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Badge variant="secondary" className="bg-emerald-900 text-emerald-400">Manual</Badge>
                        <Badge variant="secondary" className="bg-slate-800 text-slate-400">BCRA</Badge>
                    </div>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Actualización manual y automática. Los valores manuales no se sobreescriben.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                    <div className="grid grid-cols-5 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Año</span>
                        <span>Mes</span>
                        <span className="text-right">Mensual</span>
                        <span className="text-right">Interanual</span>
                        <span className="text-center">Origen</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-xs text-slate-500">Cargando...</div>
                        ) : inflationData.length > 0 ? (
                            inflationData.map((item) => {
                                const date = new Date(item.date);
                                const year = date.getUTCFullYear();
                                const month = date.getUTCMonth() + 1;
                                return (
                                    <div key={item.id} className="grid grid-cols-5 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                        <span className="text-slate-300">{year}</span>
                                        <span className="text-slate-500">{getMonthName(month)}</span>
                                        <span className="text-right font-bold text-slate-200">{(item.value * 100).toFixed(1)}%</span>
                                        <span className="text-right font-bold text-green-400">
                                            {item.interannualValue ? `${(item.interannualValue * 100).toFixed(1)}%` : '-'}
                                        </span>
                                        <div className="text-center">
                                            {item.isManual ? (
                                                <Badge variant="outline" className="text-[9px] border-blue-700 text-blue-400 bg-blue-950/30">
                                                    Manual
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">
                                                    Auto
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                                No hay datos. Ejecuta "Seed Historical Data" o agrega valores manualmente.
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


function UsersCard() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Linking Existing Logic
    const [linkDialog, setLinkDialog] = useState(false);
    const [userToLink, setUserToLink] = useState<any>(null);
    const [linkSourceId, setLinkSourceId] = useState('');

    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };




    const handleLinkAccount = async () => {
        if (!userToLink) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'LINK_MIRROR',
                    targetUserId: userToLink.id,
                    sourceUserId: linkSourceId === 'none' ? '' : linkSourceId,
                })
            });
            if (res.ok) {
                setLinkDialog(false);
                setUserToLink(null);
                setLinkSourceId('');
                fetchUsers();
            } else {
                alert("Error vinculando cuenta");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const openLinkDialog = (user: any) => {
        setUserToLink(user);
        setLinkSourceId(user.dataOwnerId || 'none');
        setLinkDialog(true);
    };

    return (
        <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col md:col-span-2">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-slate-100 text-lg">Gestión de Usuarios</CardTitle>

                    <div className="h-8"></div> {/* Spacer to replace button */}

                    {/* LINK EXISTING DIALOG */}
                    <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
                        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100">
                            <DialogHeader>
                                <DialogTitle>Vincular Cuenta (Espejo)</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <p className="text-xs text-slate-400">
                                    Estás editando a: <strong className="text-white">{userToLink?.name || userToLink?.email}</strong>
                                </p>
                                <div className="space-y-2">
                                    <Label>Ver datos de (Dueño):</Label>
                                    <Select value={linkSourceId} onValueChange={setLinkSourceId}>
                                        <SelectTrigger className="bg-slate-900 border-slate-700">
                                            <SelectValue placeholder="Ninguno (Cuenta Independiente)" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700">
                                            <SelectItem value="none">-- Ninguno (Desvincular) --</SelectItem>
                                            {users.filter(u => u.id !== userToLink?.id && !u.dataOwnerId).map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name || u.email}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-yellow-500 pt-2">
                                        ⚠ Si vinculás, este usuario dejará de ver sus datos propios y verá los del dueño seleccionado.
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleLinkAccount} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700">
                                    {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    Administración de accesos y cuentas compartidas.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden h-full flex flex-col">
                    <div className="grid grid-cols-4 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span className="col-span-1">Usuario</span>
                        <span className="col-span-1">Email</span>
                        <span className="text-center">Rol</span>
                        <span className="text-right">Acceso / Link</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-xs text-slate-500">Cargando...</div>
                        ) : (
                            users.map(u => (
                                <div key={u.id} className="grid grid-cols-4 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 items-center">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200">{u.name}</span>
                                        <span className="text-[10px] text-slate-500">ID: {u.id.substring(0, 8)}...</span>
                                    </div>
                                    <span className="text-slate-400 truncate pr-2">{u.email}</span>
                                    <div className="text-center">
                                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">{u.role}</Badge>
                                    </div>
                                    <div className="text-right">
                                        {u.dataOwnerId ? (
                                            <Badge variant="secondary" className="bg-purple-900/50 text-purple-300 text-[10px] hover:bg-purple-900">
                                                Espejo
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-emerald-900/50 text-emerald-300 text-[10px] hover:bg-emerald-900">
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 ml-2"
                                            onClick={() => openLinkDialog(u)}
                                        >
                                            <RefreshCw className="h-3 w-3 text-slate-500 hover:text-white" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
