
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Link as LinkIcon, Pencil, X, Loader2, Upload, FileText } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { upload } from '@vercel/blob/client';

interface TransactionsTabProps {
    type: 'INCOME' | 'EXPENSE'; // Controls Mode
}

export function TransactionsTab({ type }: TransactionsTabProps) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Rental Specifics
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [contractUrl, setContractUrl] = useState('');

    // Upload State
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        const [catRes, trxRes] = await Promise.all([
            fetch('/api/costa/categories'),
            fetch('/api/costa/transactions')
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (trxRes.ok) setTransactions(await trxRes.json());
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    // Logic to detect if "Alquiler" is selected
    const isRental = type === 'INCOME' && categories.find(c => c.id === categoryId)?.name.toLowerCase().includes('alquiler');

    useEffect(() => {
        // If isRental, sync Date with CheckIn
        if (isRental && checkIn) {
            setDate(checkIn);
        }
    }, [checkIn, isRental]);

    const [selectedYear, setSelectedYear] = useState<string>('ALL');

    const uniqueYears = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort((a, b) => b - a);

    const categoryOptions = categories.filter(c => c.type === type);

    const filteredTransactions = transactions
        .filter(t => t.type === type)
        .filter(t => selectedYear === 'ALL' || new Date(t.date).getFullYear().toString() === selectedYear);

    // Grouping Logic
    const groupedTransactions: { [key: string]: any[] } = {};
    filteredTransactions.forEach(t => {
        const [y, m, d] = new Date(t.date).toISOString().split('T')[0].split('-').map(Number);
        const localDate = new Date(y, m - 1, d);

        const dateKey = format(localDate, 'MMMM yyyy', { locale: es });
        if (!groupedTransactions[dateKey]) groupedTransactions[dateKey] = [];
        groupedTransactions[dateKey].push(t);
    });

    const handleEdit = (trx: any) => {
        setEditingId(trx.id);
        setCategoryId(trx.categoryId || '');
        setDescription(trx.description || '');
        setAmount(trx.amount.toString());
        setCurrency(trx.currency);
        setDate(trx.date ? new Date(trx.date).toISOString().split('T')[0] : '');

        setCheckIn(trx.rentalCheckIn ? new Date(trx.rentalCheckIn).toISOString().split('T')[0] : '');
        setCheckOut(trx.rentalCheckOut ? new Date(trx.rentalCheckOut).toISOString().split('T')[0] : '');
        setContractUrl(trx.contractUrl || '');
        setInputFile(null);
        // Scroll to form (optional)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        resetForm();
    };

    const resetForm = () => {
        setCategoryId('');
        setDescription('');
        setAmount('');
        setCurrency('USD');
        setDate(new Date().toISOString().split('T')[0]);
        setCheckIn('');
        setCheckOut('');
        setContractUrl('');
        setInputFile(null);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!amount) {
            alert('Ingrese un monto');
            return;
        }
        if (!categoryId) {
            alert('Seleccione una categoría');
            return;
        }

        if (isRental) {
            if (!checkIn || !checkOut) {
                alert('Ingrese fechas de Check In y Check Out para el alquiler');
                return;
            }
        } else {
            if (!date) {
                alert('Ingrese una fecha');
                return;
            }
        }

        setIsSubmitting(true);

        try {
            // Upload Logic
            let finalContractUrl = contractUrl;
            if (inputFile) {
                setIsUploading(true);
                const newBlob = await upload(inputFile.name, inputFile, {
                    access: 'public',
                    handleUploadUrl: '/api/upload',
                });
                finalContractUrl = newBlob.url;
                setIsUploading(false);
            }

            // If Rental, override date with checkIn
            const finalDate = (isRental && checkIn) ? checkIn : date;

            const url = editingId ? '/api/costa/transactions' : '/api/costa/transactions';
            const method = editingId ? 'PUT' : 'POST';
            const body = {
                id: editingId,
                type,
                date: finalDate,
                amount,
                currency,
                description,
                categoryId,
                rentalCheckIn: (type === 'INCOME' && categoryId && checkIn) ? checkIn : null,
                rentalCheckOut: (type === 'INCOME' && categoryId && checkOut) ? checkOut : null,
                contractUrl: (type === 'INCOME' && categoryId) ? finalContractUrl : null
            };

            const res = await fetch(url, {
                method,
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                let errorMsg = 'Error al guardar';
                try {
                    const errorData = await res.json();
                    if (errorData.error) errorMsg = errorData.error;
                } catch (e) {
                    const text = await res.text();
                    if (text) errorMsg = text;
                }
                throw new Error(errorMsg);
            }

            setEditingId(null);
            resetForm();
            loadData();
        } catch (error: any) {
            console.error(error);
            alert(`Ocurrió un error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar movimiento?')) return;
        await fetch(`/api/costa/transactions?id=${id}`, { method: 'DELETE' });
        loadData();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* FORM */}
            <Card className={`bg-slate-900 border-slate-800 lg:col-span-1 h-fit ${editingId ? 'border-blue-500 shadow-blue-900/20 shadow-lg' : ''}`}>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className={type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}>
                        {editingId ? 'Editar Movimiento' : (type === 'INCOME' ? 'Registrar Alquiler' : 'Registrar Gasto')}
                    </CardTitle>
                    {editingId && (
                        <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-6 w-6 rounded-full bg-slate-800 text-slate-400 hover:text-white">
                            <X size={14} />
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Categoría</Label>
                            <Select value={categoryId} onValueChange={setCategoryId}>
                                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent className="bg-slate-950 border-slate-700 text-white z-50">
                                    {categoryOptions.map(c => <SelectItem key={c.id} value={c.id} className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Rental Dates (Only if Rental Category selected) */}
                        {isRental && (
                            <div className="space-y-4 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-400">Check In</Label>
                                        <Input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="bg-slate-900 h-9 text-sm text-white border-slate-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-400">Check Out</Label>
                                        <Input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="bg-slate-900 h-9 text-sm text-white border-slate-700" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-400">Contrato (Documento)</Label>
                                    <div className="space-y-2">
                                        <Input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={e => setInputFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-400
                                                file:mr-4 file:py-1 file:px-2
                                                file:rounded-full file:border-0
                                                file:text-xs file:font-semibold
                                                file:bg-blue-600 file:text-white
                                                hover:file:bg-blue-700
                                                cursor-pointer bg-slate-900 h-10 border-slate-700 pt-1.5"
                                        />
                                        {contractUrl && !inputFile && (
                                            <div className="flex items-center gap-2 bg-emerald-950/30 p-2 rounded border border-emerald-900/50">
                                                <FileText size={14} className="text-emerald-400" />
                                                <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline truncate">
                                                    Ver contrato actual
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {!isRental && (
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Fecha</Label>
                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
                                </div>
                            )}
                            <div className={`space-y-2 ${isRental ? 'col-span-2' : ''}`}>
                                <Label className="text-slate-300">Moneda</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-950 border-slate-700 text-white z-50">
                                        <SelectItem value="USD" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">USD</SelectItem>
                                        <SelectItem value="ARS" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">ARS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Monto</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="bg-slate-800 border-slate-700 font-bold text-lg text-white placeholder:text-slate-500"
                                placeholder="0.00"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Descripción (Opcional)</Label>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                                placeholder={isRental ? "Ej. Familia Perez" : "Ej. Depósito seña"}
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={isSubmitting || isUploading} className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
                                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isUploading ? 'Subiendo...' : (editingId ? 'Actualizar' : 'Guardar')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* TABLE (History) */}
            <Card className="bg-slate-900 border-slate-800 lg:col-span-2 h-fit">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white">{type === 'INCOME' ? 'Alquileres' : 'Gastos'}</CardTitle>
                    {type === 'EXPENSE' && (
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px] bg-slate-800 border-slate-700 text-white h-8 text-xs">
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-700 text-white">
                                <SelectItem value="ALL">Todo</SelectItem>
                                {uniqueYears.map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-950">
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead className="text-slate-400">Categoría</TableHead>
                                {type === 'INCOME' ? (
                                    <>
                                        <TableHead className="text-slate-400">Check In</TableHead>
                                        <TableHead className="text-slate-400">Check Out</TableHead>
                                        <TableHead className="text-slate-400">Días</TableHead>
                                        <TableHead className="text-slate-400 text-center">Precio/Noche</TableHead>
                                    </>
                                ) : (
                                    <TableHead className="text-slate-400">Fecha</TableHead>
                                )}
                                <TableHead className="text-slate-400">Descripción</TableHead>
                                <TableHead className="text-slate-400 text-right">Total</TableHead>
                                <TableHead className="text-right pr-4">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(groupedTransactions).sort((a, b) => new Date(b[1][0].date).getTime() - new Date(a[1][0].date).getTime()).map(([group, groupTransactions]) => (
                                <React.Fragment key={group}>
                                    {type === 'EXPENSE' && (
                                        <TableRow className="bg-slate-950/80 hover:bg-slate-950/80">
                                            <TableCell colSpan={5} className="font-bold text-slate-300 text-xs uppercase tracking-wider py-1">
                                                {group}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {groupTransactions.map(t => (
                                        <TableRow key={t.id} className={`border-slate-800 hover:bg-slate-800/50 ${editingId === t.id ? 'bg-slate-800/80 border-l-2 border-l-blue-500' : ''}`}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-white">{t.category?.name || '-'}</span>
                                                    {t.contractUrl && (type === 'INCOME') && (
                                                        <a href={t.contractUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 mt-1">
                                                            <FileText size={10} /> Ver Contrato
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            {type === 'INCOME' ? (
                                                <>
                                                    <TableCell className="text-slate-300">
                                                        {t.rentalCheckIn ? format(new Date(t.rentalCheckIn), 'dd/MM/yyyy') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-slate-300">
                                                        {t.rentalCheckOut ? format(new Date(t.rentalCheckOut), 'dd/MM/yyyy') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-slate-300 text-center">
                                                        {t.rentalCheckIn && t.rentalCheckOut
                                                            ? Math.ceil((new Date(t.rentalCheckOut).getTime() - new Date(t.rentalCheckIn).getTime()) / (1000 * 60 * 60 * 24))
                                                            : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center text-slate-400 text-xs">
                                                        {t.rentalCheckIn && t.rentalCheckOut
                                                            ? (() => {
                                                                const days = Math.ceil((new Date(t.rentalCheckOut).getTime() - new Date(t.rentalCheckIn).getTime()) / (1000 * 60 * 60 * 24));
                                                                return days > 0
                                                                    ? (t.currency + ' ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(t.amount / days))
                                                                    : '-';
                                                            })()
                                                            : '-'}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <TableCell className="text-slate-300">
                                                    {format(new Date(t.date), 'dd/MM/yyyy')}
                                                </TableCell>
                                            )}

                                            <TableCell className="text-slate-400 text-sm max-w-[150px] truncate" title={t.description}>{t.description}</TableCell>
                                            <TableCell className={`text-right font-bold ${type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                {t.currency} {new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(t.amount)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(t)} disabled={!!editingId && editingId !== t.id} className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 h-8 w-8">
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(t.id)} disabled={!!editingId} className="text-slate-600 hover:text-red-400 hover:bg-red-950/30 h-8 w-8">
                                                        <Pencil size={14} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </React.Fragment>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Sin movimientos registrados</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
