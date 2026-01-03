'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Pencil } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useState } from 'react';
import { AddBankOperationDialog } from './AddBankOperationDialog';

interface BankOperationsTabProps {
    operations: any[];
    onRefresh: () => void;
    showValues: boolean;
}

export function BankOperationsTab({ operations, onRefresh, showValues }: BankOperationsTabProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingOp, setEditingOp] = useState<any>(null);

    const formatMoney = (val: number, cur: string) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur }).format(val);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta operación?')) return;
        setDeletingId(id);
        try {
            await fetch(`/api/bank-investments/${id}`, { method: 'DELETE' });
            onRefresh();
        } catch (error) {
            console.error('Failed to delete', error);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl font-bold text-white">Listado de Operaciones</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-950">
                            <TableRow className="hover:bg-transparent border-slate-800">
                                <TableHead className="text-slate-400">Tipo / Alias</TableHead>
                                <TableHead className="text-slate-400">Fecha Concertación</TableHead>
                                <TableHead className="text-slate-400">Vencimiento</TableHead>
                                <TableHead className="text-slate-400 text-center">Plazo</TableHead>
                                <TableHead className="text-slate-400 text-right">Monto</TableHead>
                                <TableHead className="text-slate-400 text-right">TNA</TableHead>
                                <TableHead className="text-emerald-400 text-right">Interés</TableHead>
                                <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {operations.map((op) => {
                                const isPF = op.type === 'PLAZO_FIJO';
                                const interest = isPF && op.tna && op.durationDays
                                    ? op.amount * (op.tna / 100) * (op.durationDays / 365)
                                    : 0;

                                // Calculate End Date if missing
                                let endDate = op.endDate ? new Date(op.endDate) : null;
                                if (!endDate && isPF && op.startDate && op.durationDays) {
                                    endDate = addDays(new Date(op.startDate), op.durationDays);
                                }

                                return (
                                    <TableRow key={op.id} className="border-slate-800 hover:bg-slate-800/50">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-white">
                                                    {op.type.replace(/_/g, ' ')} {op.name ? `- ${op.name}` : ''}
                                                </span>
                                                {op.alias && <span className="text-xs text-slate-500 italic">{op.alias}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            {op.startDate ? format(new Date(op.startDate), 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-slate-300">
                                            {isPF && endDate ? format(endDate, 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-center text-slate-300">
                                            {isPF ? `${op.durationDays} días` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-white">
                                            {showValues ? formatMoney(op.amount, op.currency) : '****'}
                                        </TableCell>
                                        <TableCell className="text-right text-slate-300">
                                            {isPF ? `${op.tna}%` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-emerald-400">
                                            {isPF && showValues ? `+${formatMoney(interest, op.currency)}` : (isPF ? '****' : '-')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/30"
                                                    onClick={() => setEditingOp(op)}
                                                >
                                                    <Pencil size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                                    onClick={() => handleDelete(op.id)}
                                                    disabled={deletingId === op.id}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {operations.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                        No hay operaciones registradas.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Dialog (Controlled) */}
            {editingOp && (
                <AddBankOperationDialog
                    open={!!editingOp}
                    onOpenChange={(open) => !open && setEditingOp(null)}
                    initialData={editingOp}
                    onSaved={() => {
                        setEditingOp(null);
                        onRefresh();
                    }}
                />
            )}
        </>
    );
}
