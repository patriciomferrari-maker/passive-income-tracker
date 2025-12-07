'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { ONForm } from '@/components/on/ONForm';
import { format } from 'date-fns';

interface ON {
    id: string;
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
    const [ons, setOns] = useState<ON[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingON, setEditingON] = useState<ON | null>(null);

    useEffect(() => {
        loadONs();
    }, []);

    const loadONs = async () => {
        try {
            const res = await fetch('/api/investments/on');
            const data = await res.json();
            setOns(data);
        } catch (error) {
            console.error('Error loading ONs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: any) => {
        try {
            if (editingON) {
                await fetch(`/api/investments/on/${editingON.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                await fetch('/api/investments/on', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
            await loadONs();
            setShowForm(false);
            setEditingON(null);
        } catch (error) {
            throw error;
        }
    };

    const handleDelete = async (id: string) => {
        console.log('Attempting to delete ON:', id);
        if (!confirm('¿Estás seguro de eliminar esta ON? Se borrarán todas las compras y cashflows asociados.')) {
            console.log('Deletion cancelled by user');
            return;
        }

        try {
            console.log('Sending DELETE request...');
            const res = await fetch(`/api/investments/on/${id}`, { method: 'DELETE' });
            console.log('DELETE response status:', res.status);
            if (!res.ok) {
                const text = await res.text();
                console.error('DELETE failed:', text);
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
        <>
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                        ONs Configuradas
                        <Button
                            onClick={() => {
                                setEditingON(null);
                                setShowForm(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva ON
                        </Button>
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                        Define las características de cada ON para calcular los flujos de fondos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : ons.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay ONs configuradas. Haz clic en "Nueva ON" para agregar una.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
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
                                                    {on.amortization || 'BULLET'}
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
    );
}
