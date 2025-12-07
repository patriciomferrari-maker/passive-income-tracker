'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Banknote, History, PlusCircle } from 'lucide-react';

interface Debt {
    id: string;
    debtorName: string;
    initialAmount: number;
    currency: string;
    balance: number;
}

interface Payment {
    id: string;
    amount: number;
    date: string;
    description: string;
    type: string; // 'PAYMENT' | 'INCREASE'
}

interface TabProps {
    showValues?: boolean;
}

export function DebtsPaymentFlowTab({ showValues = true }: TabProps) {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [selectedDebtId, setSelectedDebtId] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [transactionType, setTransactionType] = useState('PAYMENT'); // 'PAYMENT' or 'INCREASE'
    const [submitting, setSubmitting] = useState(false);
    const [debtPayments, setDebtPayments] = useState<Payment[]>([]);

    useEffect(() => {
        loadDebts();
    }, []);

    useEffect(() => {
        if (selectedDebtId) {
            loadPayments(selectedDebtId);
        } else {
            setDebtPayments([]);
        }
    }, [selectedDebtId]);

    const loadDebts = async () => {
        try {
            const res = await fetch('/api/debts');
            const data = await res.json();
            setDebts(data);
        } catch (error) {
            console.error('Error loading debts:', error);
        }
    };

    const loadPayments = async (debtId: string) => {
        try {
            const res = await fetch(`/api/debts/${debtId}/payments`);
            const data = await res.json();
            setDebtPayments(data);
        } catch (error) {
            console.error('Error loading payments:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDebtId) {
            alert("Por favor selecciona un deudor.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                amount: parseFloat(amount),
                date,
                description,
                type: transactionType
            };
            console.log('Sending payload:', payload);

            const res = await fetch(`/api/debts/${selectedDebtId}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setAmount('');
                setDescription('');
                setDate(new Date().toISOString().split('T')[0]);
                loadPayments(selectedDebtId);
                loadDebts();
                alert("Operación registrada con éxito.");
            } else {
                const err = await res.json();
                alert(`Error al registrar: ${err.error || 'Error desconocido'}`);
            }
        } catch (error) {
            console.error('Error creating transaction:', error);
            alert("Error de conexión al registrar operación.");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayOff = () => {
        const debt = debts.find(d => d.id === selectedDebtId);
        if (debt) {
            setTransactionType('PAYMENT');
            setAmount(debt.balance.toString());
            setDescription('Cancelación total de deuda');
        }
    };

    const selectedDebt = debts.find(d => d.id === selectedDebtId);

    const formatCurrency = (val: number, currency: string) => {
        if (!showValues) return '****';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Flujo de Fondos</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transaction Form */}
                <Card className="bg-slate-950 border-slate-800 lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            {transactionType === 'PAYMENT' ? (
                                <Banknote size={20} className="text-emerald-500" />
                            ) : (
                                <PlusCircle size={20} className="text-rose-500" />
                            )}
                            {transactionType === 'PAYMENT' ? 'Registrar Cobro' : 'Prestar Más (Toma Deuda)'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6">
                            <Tabs value={transactionType} onValueChange={(v) => {
                                setTransactionType(v);
                                setAmount(''); // Reset amount on switch
                            }}>
                                <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-700">
                                    <TabsTrigger value="PAYMENT" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                                        Cobrar
                                    </TabsTrigger>
                                    <TabsTrigger value="INCREASE" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                                        Prestar
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="debtor" className="text-slate-300">Seleccionar Deudor</Label>
                                <div className="relative">
                                    <select
                                        className="w-full h-10 bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500 appearance-none cursor-pointer"
                                        value={selectedDebtId}
                                        onChange={(e) => setSelectedDebtId(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Elige un deudor...</option>
                                        {debts.map(debt => (
                                            <option key={debt.id} value={debt.id} className="bg-slate-900 text-white">
                                                {debt.debtorName} ({formatCurrency(debt.balance, debt.currency)})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down opacity-50"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="amount" className="text-slate-300">Monto</Label>
                                    {transactionType === 'PAYMENT' && selectedDebt && (
                                        <button
                                            type="button"
                                            onClick={handlePayOff}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                                        >
                                            Saldar Deuda
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        required
                                        className="bg-slate-900 border-slate-700 text-white pl-8"
                                    />
                                    <span className="absolute left-3 top-2.5 text-slate-500 text-sm">
                                        {selectedDebt?.currency === 'ARS' ? '$' : 'u$s'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-slate-300">Fecha</Label>
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
                                <Label htmlFor="description" className="text-slate-300">Concepto / Nota</Label>
                                <Input
                                    id="description"
                                    placeholder={transactionType === 'PAYMENT' ? "Ej: Pago parcial..." : "Ej: Préstamo adicional..."}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="bg-slate-900 border-slate-700 text-white"
                                />
                            </div>

                            <Button
                                type="submit"
                                className={`w-full text-white mt-4 ${transactionType === 'PAYMENT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} border border-slate-700`}
                                disabled={submitting || !selectedDebtId}
                            >
                                {submitting ? 'Registrando...' : (transactionType === 'PAYMENT' ? 'Confirmar Cobro' : 'Confirmar Préstamo')}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* History Table */}
                <Card className="bg-slate-950 border-slate-800 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <History size={20} className="text-blue-500" />
                            Movimientos {selectedDebt ? `- ${selectedDebt.debtorName}` : ''}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!selectedDebtId ? (
                            <div className="text-center py-12 text-slate-500">
                                Selecciona un deudor para ver sus movimientos.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-left">
                                            <th className="py-3 px-4 text-slate-400 font-medium">Fecha</th>
                                            <th className="py-3 px-4 text-slate-400 font-medium">Tipo</th>
                                            <th className="py-3 px-4 text-slate-400 font-medium">Concepto</th>
                                            <th className="py-3 px-4 text-slate-400 font-medium text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {debtPayments.map(payment => (
                                            <tr key={payment.id} className="border-b border-slate-800 hover:bg-slate-900/50">
                                                <td className="py-3 px-4 text-slate-300">
                                                    {new Date(payment.date).toLocaleDateString('es-AR')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {payment.type === 'INCREASE' ? (
                                                        <span className="text-amber-500 font-medium flex items-center gap-1"><PlusCircle size={12} /> Préstamo</span>
                                                    ) : (
                                                        <span className="text-emerald-500 font-medium flex items-center gap-1"><Banknote size={12} /> Cobro</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-white font-medium">
                                                    {payment.description || '-'}
                                                </td>
                                                <td className={`py-3 px-4 font-mono text-right font-bold ${payment.type === 'INCREASE' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {payment.type === 'INCREASE' ? '+' : '-'} {formatCurrency(payment.amount, selectedDebt?.currency || 'USD')}
                                                </td>
                                            </tr>
                                        ))}
                                        {debtPayments.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-slate-500">
                                                    No hay movimientos registrados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
