'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Globe, Database } from 'lucide-react';
import { ONForm } from '@/components/on/ONForm';
import { GlobalCatalogTab } from '@/components/on/GlobalCatalogTab';
import { format } from 'date-fns';

interface ON {
    id: string;
    type?: string;
    ticker: string;
    name: string;
    emissionDate: string | null;
    couponRate: number | null;
    frequency: number | null;
    maturityDate: string | null;
    amortization: string | null;
    amortizationSchedules: any[];
    _count: { transactions: number };
}

export function ConfigurationTab() {
    const [subTab, setSubTab] = useState<'catalog' | 'manual'>('catalog');
    const [ons, setOns] = useState<ON[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingON, setEditingON] = useState<ON | null>(null);

    useEffect(() => {
        if (subTab === 'manual') {
            loadONs();
        }
    }, [subTab]);

    const loadONs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/investments/on?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setOns(data.sort((a: any, b: any) => {
                    const typeA = a.type || '';
                    const typeB = b.type || '';
                    if (typeA !== typeB) return typeA.localeCompare(typeB);
                    return a.ticker.localeCompare(b.ticker);
                }));
            }
        } catch (error) {
            console.error('Error loading ONs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: any) => {
        try {
            let res;
            if (editingON) {
                res = await fetch(`/api/investments/on/${editingON.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                res = await fetch('/api/investments/on', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                throw new Error(err.error || 'Error al guardar');
            }

            await loadONs();
            setShowForm(false);
            setEditingON(null);
        } catch (error: any) {
            alert('Error detallado: ' + error.message);
            throw error;
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta ON? Se borrarán todas las compras y cashflows asociados.')) {
            return;
        }

        try {
            const res = await fetch(`/api/investments/on/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                console.error('DELETE failed');
            }
            await loadONs();
        } catch (error) {
            console.error('Error deleting ON:', error);
            alert('Error al eliminar la ON');
        }
    };

    const handleEdit = (on: ON) => {
        setEditingON(on);
        setShowForm(true);
    };

    return (
        <div className="space-y-6">
            {/* Sub-Tabs Navigation */}
            <div className="flex p-1 bg-slate-900/50 rounded-lg w-fit border border-slate-800">
                <button
                    onClick={() => setSubTab('catalog')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subTab === 'catalog'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Globe size={16} />
                    Catálogo Global
                </button>
                <button
                    onClick={() => setSubTab('manual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${subTab === 'manual'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Database size={16} />
                    Mis Activos (Manual)
                </button>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
                try {
                    const res = await fetch('/api/debug-auth?t=' + Date.now());
                    const data = await res.json();
                    alert(`Debug Info:\nUser ID: ${data.userId}\nAuth: ${data.authenticated}`);
                } catch (e: any) { alert('Debug Failed: ' + e.message); }
            }} className="text-xs text-slate-500 border-slate-700">
                🛠️ Debug Auth
            </Button>
        </div>

            {
        subTab === 'catalog' ? (
            <GlobalCatalogTab excludeMarket="US" />
        ) : (
        <>
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                        ONs y Manuales
                        <Button
                            onClick={() => {
                                setEditingON(null);
                                setShowForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Manual
                        </Button>
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                        Gestiona activos que requieren configuración manual de flujos (ej. Obligaciones Negociables).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : ons.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay activos manuales configurados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Tipo</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Ticker</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Nombre</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Tasa</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Frecuencia</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Vencimiento</th>
                                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Amortización</th>
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ons.map((on) => (
                                        <tr key={on.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-3 px-4">
                                                <span className={`text-[10px] items-center px-1.5 py-0.5 rounded font-medium border ${on.type === 'ON' || on.type === 'CORPORATE_BOND' ? 'bg-blue-900/40 text-blue-300 border-blue-800' :
                                                    on.type === 'CEDEAR' ? 'bg-purple-900/40 text-purple-300 border-purple-800' :
                                                        'bg-green-900/40 text-green-300 border-green-800'
                                                    }`}>
                                                    {(on.type === 'CORPORATE_BOND' ? 'ON' : (on.type || 'ON'))}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-white font-mono">{on.ticker}</td>
                                            <td className="py-3 px-4 text-white">{on.name}</td>
                                            <td className="py-3 px-4 text-slate-300">
                                                {on.couponRate ? `${(on.couponRate * 100).toFixed(2)}%` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-300">
                                                {on.frequency ? `${on.frequency} meses` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-300">
                                                {on.maturityDate ? format(new Date(on.maturityDate), 'dd/MM/yyyy') : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-300">
                                                <span className={`px-2 py-1 rounded text-xs ${on.amortization === 'BULLET'
                                                    ? 'bg-blue-500/20 text-blue-300'
                                                    : 'bg-purple-500/20 text-purple-300'
                                                    }`}>
                                                    {(on.type === 'ON' || on.type === 'CORPORATE_BOND') ? (on.amortization || 'BULLET') : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(on)}
                                                        className="text-blue-400 hover:text-blue-300"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(on.id)}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {showForm && (
                <ONForm
                    onClose={() => {
                        setShowForm(false);
                        setEditingON(null);
                    }}
                    onSave={handleSave}
                    initialData={editingON}
                />
            )}
        </>
    )
    }
        </div >
    );
}
