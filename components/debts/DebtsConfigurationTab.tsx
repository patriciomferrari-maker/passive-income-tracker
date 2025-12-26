'use client';

// ... imports
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';

interface Debt {
    id: string;
    debtorName: string;
    type?: string; // OWED_TO_ME, I_OWE (optional for backward compatibility)
    startDate: string;
    initialAmount: number;
    currency: string;
    balance: number;
}

interface TabProps {
    showValues?: boolean;
}

export function DebtsConfigurationTab({ showValues = true }: TabProps) {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [debtorName, setDebtorName] = useState('');
    const [debtType, setDebtType] = useState('OWED_TO_ME');
    const [details, setDetails] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [currency, setCurrency] = useState('USD');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadDebts();
    }, []);

    const loadDebts = async () => {
        try {
            const res = await fetch('/api/debts');
            const data = await res.json();
            setDebts(data);
        } catch (error) {
            console.error('Error loading debts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/debts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    debtorName,
                    type: debtType,
                    initialAmount: parseFloat(amount),
                    startDate: date,
                    currency,
                    details
                })
            });

            if (res.ok) {
                // Reset form
                setDebtorName('');
                setDebtType('OWED_TO_ME');
                setAmount('');
                setDetails('');
                setDate(new Date().toISOString().split('T')[0]);
                loadDebts(); // Reload list
            }
        } catch (error) {
            console.error('Error creating debt:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (val: number, currency: string) => {
        if (!showValues) return '****';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Configuración de Deudas</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form dedicated to CREATE ONLY for now */}
                <Card className="bg-slate-950 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <PlusCircle size={20} className="text-emerald-500" />
                            Nueva Deuda
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Tipo de Deuda *</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setDebtType('OWED_TO_ME')}
                                        className={`px-4 py-2 rounded border transition-colors ${debtType === 'OWED_TO_ME' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                    >
                                        💰 Me deben
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDebtType('I_OWE')}
                                        className={`px-4 py-2 rounded border transition-colors ${debtType === 'I_OWE' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                    >
                                        💸 Yo debo
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="debtor" className="text-slate-300">
                                    {debtType === 'OWED_TO_ME' ? 'Deudor' : 'Acreedor'}
                                </Label>
                                <Input
                                    id="debtor"
                                    placeholder={debtType === 'OWED_TO_ME' ? 'Nombre del deudor' : 'Nombre del acreedor'}
                                    value={debtorName}
                                    onChange={e => setDebtorName(e.target.value)}
                                    required
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount" className="text-slate-300">Monto</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        required
                                        className="bg-slate-900 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="currency" className="text-slate-300">Moneda</Label>
                                    <Select value={currency} onValueChange={setCurrency}>
                                        <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700">
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="ARS">ARS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-slate-300">Fecha Inicio</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="details" className="text-slate-300">Detalle / Concepto</Label>
                                <Input
                                    id="details"
                                    placeholder="Ej: Préstamo para auto..."
                                    value={details}
                                    onChange={e => setDetails(e.target.value)}
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4 relative z-20"
                                disabled={submitting}
                            >
                                {submitting ? 'Guardando...' : 'Crear Deuda'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* List of Debts */}
                <Card className="bg-slate-950 border-slate-800 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-white">Deudas Activas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 text-left">
                                        <th className="py-3 px-4 text-slate-400 font-medium">Nombre</th>
                                        <th className="py-3 px-4 text-slate-400 font-medium">Tipo</th>
                                        <th className="py-3 px-4 text-slate-400 font-medium">Fecha</th>
                                        <th className="py-3 px-4 text-slate-400 font-medium text-right">Monto Original</th>
                                        <th className="py-3 px-4 text-slate-400 font-medium text-right">Saldo Actual</th>
                                        <th className="py-3 px-4 text-slate-400 font-medium text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {debts.map(debt => (
                                        <tr key={debt.id} className="border-b border-slate-800 hover:bg-slate-900/50">
                                            <td className="py-3 px-4 text-white font-medium">{debt.debtorName}</td>
                                            <td className="py-3 px-4">
                                                <span className={`text-xs px-2 py-1 rounded ${(debt.type || 'OWED_TO_ME') === 'OWED_TO_ME' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {(debt.type || 'OWED_TO_ME') === 'OWED_TO_ME' ? '💰 Me deben' : '💸 Yo debo'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-slate-400">
                                                {new Date(debt.startDate).toLocaleDateString('es-AR')}
                                            </td>
                                            <td className="py-3 px-4 text-slate-300 font-mono text-right">
                                                {formatCurrency(debt.initialAmount, debt.currency)}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-right font-bold text-rose-400">
                                                {formatCurrency(debt.balance, debt.currency)}
                                            </td>
                                            <td className="py-3 px-4 text-center">

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-slate-500 hover:text-red-500 hover:bg-red-500/10"
                                                    onClick={async () => {
                                                        if (!confirm('¿Estás seguro de eliminar esta deuda y todos sus movimientos?')) return;
                                                        setLoading(true);
                                                        try {
                                                            await fetch(`/api/debts?id=${debt.id}`, { method: 'DELETE' });
                                                            loadDebts();
                                                        } catch (e) { console.error(e) }
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {debts.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500">
                                                No hay deudas registradas.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
