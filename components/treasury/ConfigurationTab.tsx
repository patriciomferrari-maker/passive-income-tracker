'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { TreasuryForm } from '@/components/treasury/TreasuryForm';
import { format } from 'date-fns';

interface Treasury {
    id: string;
    ticker: string;
    name: string;
    emissionDate: string | null;
    couponRate: number | null;
    frequency: number | null;
    maturityDate: string | null;
    _count: { transactions: number };
}

export function ConfigurationTab() {
    const [treasuries, setTreasuries] = useState<Treasury[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingTreasury, setEditingTreasury] = useState<Treasury | null>(null);

    useEffect(() => {
        loadTreasuries();
    }, []);

    const loadTreasuries = async () => {
        try {
            const res = await fetch('/api/investments/treasury');
            const data = await res.json();
            setTreasuries(data);
        } catch (error) {
            console.error('Error loading Treasuries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: any) => {
        try {
            if (editingTreasury) {
                await fetch(`/api/investments/treasury/${editingTreasury.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                await fetch('/api/investments/treasury', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
            await loadTreasuries();
            setShowForm(false);
            setEditingTreasury(null);
        } catch (error) {
            throw error;
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este Treasury? Se borrarán todas las compras y cashflows asociados.')) {
            return;
        }

        try {
            const res = await fetch(`/api/investments/treasury/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const text = await res.text();
                console.error('DELETE failed:', text);
            }
            await loadTreasuries();
        } catch (error) {
            console.error('Error deleting Treasury:', error);
            alert('Error al eliminar el Treasury');
        }
    };

    const handleEdit = (treasury: Treasury) => {
        setEditingTreasury(treasury);
        setShowForm(true);
    };

    return (
        <>
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                        Treasuries Configurados
                        <Button
                            onClick={() => {
                                setEditingTreasury(null);
                                setShowForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Treasury
                        </Button>
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                        Define las características de cada Treasury para calcular los flujos de fondos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : treasuries.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay Treasuries configurados. Haz clic en "Nuevo Treasury" para agregar uno.
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
                                        <th className="text-right py-3 px-4 text-slate-300 font-medium">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {treasuries.map((treasury) => (
                                        <tr key={treasury.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-3 px-4 text-white font-mono">{treasury.ticker}</td>
                                            <td className="py-3 px-4 text-white">{treasury.name}</td>
                                            <td className="py-3 px-4 text-slate-300">
                                                {treasury.couponRate ? `${(treasury.couponRate * 100).toFixed(2)}%` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-300">
                                                {treasury.frequency ? `${treasury.frequency} meses` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-300">
                                                {treasury.maturityDate ? format(new Date(treasury.maturityDate), 'dd/MM/yyyy') : '-'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(treasury)}
                                                        className="text-blue-400 hover:text-blue-300"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(treasury.id)}
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
                <TreasuryForm
                    onClose={() => {
                        setShowForm(false);
                        setEditingTreasury(null);
                    }}
                    onSave={handleSave}
                    initialData={editingTreasury}
                />
            )}
        </>
    );
}
