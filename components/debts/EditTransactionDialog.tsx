'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface EditTransactionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, data: { amount: string; date: string; description: string; type: string }) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    transaction: any; // Using any for flexibility or specific interface
}

export function EditTransactionDialog({ isOpen, onClose, onSave, onDelete, transaction }: EditTransactionDialogProps) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('PAYMENT');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (transaction) {
            setAmount(transaction.amount?.toString() || '');
            // Format date for input type="date" (YYYY-MM-DD)
            const dateObj = new Date(transaction.date);
            // Ensure we get the correct date string handling timezone simply for input
            const safeDate = dateObj.toISOString().split('T')[0];
            setDate(safeDate);
            setDescription(transaction.description || '');
            setType(transaction.type || 'PAYMENT');
        }
    }, [transaction]);

    if (!isOpen || !transaction) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(transaction.id, { amount, date, description, type });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de que querés eliminar este movimiento?')) return;
        setLoading(true);
        try {
            if (onDelete) await onDelete(transaction.id);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-6">Editar Movimiento</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="type" className="text-slate-300">Tipo</Label>
                        <select
                            id="type"
                            className="w-full h-10 bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="PAYMENT">Cobro (Entrada)</option>
                            <option value="INCREASE">Préstamo (Salida)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount_edit" className="text-slate-300">Monto</Label>
                        <Input
                            id="amount_edit"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-slate-900 border-slate-700 text-white"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="date_edit" className="text-slate-300">Fecha</Label>
                        <Input
                            id="date_edit"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-slate-900 border-slate-700 text-white"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="desc_edit" className="text-slate-300">Concepto</Label>
                        <Input
                            id="desc_edit"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-slate-900 border-slate-700 text-white"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-slate-800">
                        {onDelete && (
                            <Button
                                type="button"
                                variant="destructive"
                                className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-900 mr-auto"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                Eliminar
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            disabled={loading}
                        >
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
