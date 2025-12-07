'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Plus, Trash2 } from 'lucide-react';

interface EconomicData {
    id: string;
    type: string;
    date: string;
    value: number;
    buyRate?: number;
    sellRate?: number;
}

export function EconomicDataTab() {
    const [activeSubTab, setActiveSubTab] = useState('ipc');
    const [ipcData, setIpcData] = useState<EconomicData[]>([]);
    const [tcData, setTcData] = useState<EconomicData[]>([]);
    const [loading, setLoading] = useState(true);
    const autoFetchAttempted = useRef(false);

    //form state
    const [showSingleForm, setShowSingleForm] = useState(false);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [date, setDate] = useState('');
    const [value, setValue] = useState('');
    const [buyRate, setBuyRate] = useState('');
    const [sellRate, setSellRate] = useState('');
    const [bulkData, setBulkData] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [ipcRes, tcRes] = await Promise.all([
                fetch('/api/economic-data/ipc'),
                fetch('/api/economic-data/tc')
            ]);

            const ipc = await ipcRes.json();
            const tc = await tcRes.json();

            if (Array.isArray(ipc)) setIpcData(ipc);

            let currentTcData: EconomicData[] = [];
            if (Array.isArray(tc)) {
                setTcData(tc);
                currentTcData = tc;
            }

            // Auto-update logic: Check if we have today's rate
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // Simple UTC check

            const hasToday = currentTcData.some(d => d.date.startsWith(todayStr));

            // Only try to fetch ONCE per session if missing
            if (!hasToday && activeSubTab === 'tc' && !autoFetchAttempted.current) {
                autoFetchAttempted.current = true;
                checkAndFetchBlue(todayStr);
            }

        } catch (error) {
            console.error('Error loading economic data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Separate function to handle the auto-fetch logic to avoid closure staleness
    const checkAndFetchBlue = async (todayStr: string) => {
        console.log("Auto-updating exchange rate...");
        await handleFetchBlue(true);
    };

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const endpoint = activeSubTab === 'ipc' ? '/api/economic-data/ipc' : '/api/economic-data/tc';

        try {
            const payload: any = {
                date,
                value: parseFloat(value)
            };

            if (activeSubTab === 'tc') {
                if (buyRate) payload.buyRate = parseFloat(buyRate);
                if (sellRate) payload.sellRate = parseFloat(sellRate);
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Error al guardar');

            await loadData();
            setDate('');
            setValue('');
            setBuyRate('');
            setSellRate('');
            setShowSingleForm(false);
            alert('Dato guardado exitosamente');
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Error al guardar el dato');
        }
    };

    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const lines = bulkData.trim().split('\n');
            const records = lines.map(line => {
                // Detect separator: Tab (Excel) or Comma
                const parts = line.includes('\t')
                    ? line.split('\t').map(s => s.trim())
                    : line.split(',').map(s => s.trim());

                if (activeSubTab === 'ipc') {
                    const [dateRaw, valueRaw] = parts;

                    // Parse Date: Handle DD/MM/YYYY
                    let date = dateRaw;
                    if (dateRaw.includes('/')) {
                        const [day, month, year] = dateRaw.split('/');
                        if (day.length === 2 && year.length === 4) {
                            date = `${year}-${month}-${day}`;
                        }
                    }

                    // Parse Value: Handle "8,30%" -> 0.083
                    let valueStr = valueRaw.replace('%', '').replace(',', '.').trim();
                    let value = parseFloat(valueStr);

                    // If input was a percentage string (checked before replace) or derived value > 1, assume it's percentage representation (e.g. 8.3)
                    // But standard is 0.083. If user inputs 8.30, we store 0.083
                    // Check original formatting logic: user sees "2.50%" for 0.025.
                    // If user provides "8.30", it should be 0.083.
                    if (value > 1 && !valueRaw.includes('%')) {
                        // Heuristic: if value > 1 (e.g. 2.5) and no % sign, treat as percentage points -> /100
                        // But if it's exchange rate (TC), value is > 1.
                        // Use activeSubTab check strictly.
                    }

                    // Specific logic for IPC pastes (e.g. "8,30%")
                    if (valueRaw.includes('%') || value > 1) {
                        value = value / 100;
                    }

                    return { date, value };
                } else {
                    // TC format: date, value OR date, value, buy, sell
                    const [dateRaw, valueRaw, buyRaw, sellRaw] = parts;
                    // Parse Date: Handle DD/MM/YYYY
                    let date = dateRaw;
                    if (dateRaw && dateRaw.includes('/')) {
                        const [day, month, year] = dateRaw.split('/');
                        if (day.length === 2 && year.length === 4) {
                            date = `${year}-${month}-${day}`;
                        }
                    }

                    const r: any = { date, value: parseFloat(valueRaw) };
                    if (buyRaw) r.buyRate = parseFloat(buyRaw);
                    if (sellRaw) r.sellRate = parseFloat(sellRaw);
                    return r;
                }
            }).filter((r: any) => r.date && !isNaN(r.value));

            if (records.length === 0) {
                alert('No se encontraron datos válidos. Formato: YYYY-MM-DD,valor[,compra,venta]');
                return;
            }

            const endpoint = activeSubTab === 'ipc' ? '/api/economic-data/ipc' : '/api/economic-data/tc';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bulk: records })
            });

            if (!res.ok) throw new Error('Error al cargar datos');

            await loadData();
            setBulkData('');
            setShowBulkForm(false);
            alert(`${records.length} registros cargados exitosamente`);
        } catch (error) {
            console.error('Error bulk uploading:', error);
            alert('Error al cargar los datos en lote');
        }
    };

    const handleFetchBlue = async (silent = false) => {
        try {
            const res = await fetch('/api/economic-data/fetch-blue', {
                method: 'POST'
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.details || 'Error al obtener cotización');
            }

            await loadData();

            if (!silent) {
                alert(`✅ Dólar Blue obtenido: $${result.rate.toFixed(2)}\nFecha: ${new Date(result.date).toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })}\nFuente: ${result.source}`);
            }
        } catch (error) {
            console.error('Error fetching blue rate:', error);
            if (!silent) {
                alert(`Error al obtener el dólar blue: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            }
        }
    };

    const handleFetchAmbito = async () => {
        // Removed blocking confirm that might be failing silently in some browsers/extensions
        // if (!confirm('Esto va a traer datos históricos desde 2023 hasta hoy desde Ámbito.com...')) return;

        try {
            setLoading(true);
            console.log("Fetching Ambito data..."); // Debug

            const res = await fetch('/api/economic-data/fetch-ambito', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: '2023-01-01',
                    endDate: new Date().toISOString().split('T')[0]
                })
            });

            console.log("Ambito response status:", res.status);

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.details || 'Error al obtener datos');
            }

            await loadData();
            alert(`✅ Datos actualizados de Ámbito\n\nRegistros: ${result.totalRecords}\nNuevos: ${result.created}\nActualizados: ${result.updated}`);
        } catch (error) {
            console.error('Error fetching from Ambito:', error);
            alert(`Error al obtener datos de Ámbito: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este dato?')) return;

        alert('Función de eliminación pendiente de implementación');
    };

    const currentData = activeSubTab === 'ipc' ? ipcData : tcData;
    const dataLabel = activeSubTab === 'ipc' ? 'IPC' : 'TC';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Datos Económicos</h2>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-slate-700">
                <button
                    onClick={() => setActiveSubTab('ipc')}
                    className={`px-4 py-2 font-medium transition-colors ${activeSubTab === 'ipc'
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-slate-400 hover:text-white'
                        }`}
                >
                    IPC (Inflación)
                </button>
                <button
                    onClick={() => setActiveSubTab('tc')}
                    className={`px-4 py-2 font-medium transition-colors ${activeSubTab === 'tc'
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-slate-400 hover:text-white'
                        }`}
                >
                    Tipo de Cambio
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={() => setShowSingleForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="mr-2" size={16} />
                    Agregar {dataLabel}
                </Button>
                <Button
                    onClick={() => setShowBulkForm(true)}
                    variant="outline"
                    className="border-slate-600 text-white hover:bg-slate-800"
                >
                    <Upload className="mr-2" size={16} />
                    Carga Masiva
                </Button>
                {activeSubTab === 'tc' && (
                    <Button
                        onClick={handleFetchAmbito}
                        variant="outline"
                        className="border-purple-600 text-purple-400 hover:bg-purple-500/10"
                        disabled={loading}
                    >
                        <Upload className="mr-2" size={16} />
                        {loading ? 'Cargando...' : 'Actualizar Histórico (Ámbito)'}
                    </Button>
                )}
            </div>

            {/* Data Table */}
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : currentData.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            <p>No hay datos de {dataLabel} cargados.</p>
                            <p className="text-sm mt-2 text-slate-500">
                                {activeSubTab === 'ipc'
                                    ? 'Cargá valores mensuales de IPC para calcular ajustes automáticos'
                                    : 'Cargá cotizaciones diarias USD/ARS para conversión de monedas'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full">
                                <thead className="sticky top-0 bg-slate-950">
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-3 px-4 text-slate-300">Fecha</th>
                                        {activeSubTab === 'tc' && (
                                            <>
                                                <th className="text-right py-3 px-4 text-slate-400 font-normal">Compra</th>
                                                <th className="text-right py-3 px-4 text-slate-400 font-normal">Venta</th>
                                            </>
                                        )}
                                        <th className="text-right py-3 px-4 text-slate-300">
                                            {activeSubTab === 'tc' ? 'TC Final (Promedio)' : 'Valor'}
                                        </th>
                                        <th className="text-right py-3 px-4 text-slate-300">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentData
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(record => (
                                            <tr key={record.id} className="border-b border-slate-800 hover:bg-slate-900">
                                                <td className="py-3 px-4 text-white">
                                                    {new Date(record.date).toLocaleDateString('es-AR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    })}
                                                </td>
                                                {activeSubTab === 'tc' && (
                                                    <>
                                                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                                                            {record.buyRate ? `$${record.buyRate.toFixed(2)}` : '-'}
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-slate-400 font-mono">
                                                            {record.sellRate ? `$${record.sellRate.toFixed(2)}` : '-'}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                                                    {activeSubTab === 'ipc'
                                                        ? `${(record.value * 100).toFixed(2)}%`
                                                        : `$${record.value.toFixed(2)}`
                                                    }
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleDelete(record.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Single Entry Form Modal */}
            {showSingleForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">
                                Agregar {dataLabel}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSingleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Fecha *
                                    </label>
                                    <input
                                        type="month"
                                        required
                                        value={date.substring(0, 7)}
                                        onChange={e => setDate(e.target.value + '-01')}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                    />
                                </div>

                                {activeSubTab === 'tc' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                                Compra (Op)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={buyRate}
                                                onChange={e => setBuyRate(e.target.value)}
                                                placeholder="1040.00"
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                                Venta (Op)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={sellRate}
                                                onChange={e => setSellRate(e.target.value)}
                                                placeholder="1060.00"
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        {activeSubTab === 'tc' ? 'TC Final / Promedio *' : 'Valor *'}
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={value}
                                        onChange={e => setValue(e.target.value)}
                                        placeholder={activeSubTab === 'ipc' ? '2.5' : '1050.50'}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        {activeSubTab === 'ipc'
                                            ? 'Ingresá el valor decimal (ej: 2.5 para 2.5%)'
                                            : 'Valor final calculado o ingresado manualmente'}
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        onClick={() => setShowSingleForm(false)}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        Guardar
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Bulk Upload Form Modal */}
            {showBulkForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">
                                Carga Masiva de {dataLabel}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleBulkSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        {activeSubTab === 'tc'
                                            ? 'Datos (formato: YYYY-MM-DD,valor[,compra,venta])'
                                            : 'Datos (formato: YYYY-MM-DD,valor)'}
                                    </label>
                                    <textarea
                                        required
                                        value={bulkData}
                                        onChange={e => setBulkData(e.target.value)}
                                        rows={10}
                                        placeholder={activeSubTab === 'ipc'
                                            ? '2024-01-01,2.5\n2024-02-01,3.2\n2024-03-01,2.8'
                                            : '2024-01-01,1050.50,1040,1060\n2024-01-02,1055.00'
                                        }
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-sm"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Una línea por registro. {activeSubTab === 'tc' ? 'Opcional: compra, venta' : ''}
                                    </p>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        onClick={() => setShowBulkForm(false)}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        Cargar Datos
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
