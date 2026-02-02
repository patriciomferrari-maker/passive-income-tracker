'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addDays, format } from 'date-fns';

interface BankOperationFormProps {
    onSaved: () => void;
    initialData?: any;
    className?: string;
}

export function BankOperationForm({ onSaved, initialData, className }: BankOperationFormProps) {
    const [loading, setLoading] = useState(false);

    // Form State
    const [type, setType] = useState('PLAZO_FIJO');
    const [alias, setAlias] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');

    // PF Specifics
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [durationDays, setDurationDays] = useState('30');
    const [tna, setTna] = useState('');

    // Calculated Interest
    const [estimatedInterest, setEstimatedInterest] = useState(0);

    // Load Initial Data
    useEffect(() => {
        if (initialData) {
            setType(initialData.type);
            setAlias(initialData.alias || '');
            setAmount(initialData.amount.toString());
            setCurrency(initialData.currency);
            if (initialData.type === 'PLAZO_FIJO') {
                setStartDate(initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                setDurationDays(initialData.durationDays?.toString() || '30');
                setTna(initialData.tna?.toString() || '');
            }
        }
    }, [initialData]);

    // Auto-Calculate Interest
    useEffect(() => {
        if (type === 'PLAZO_FIJO' && amount && tna && durationDays) {
            const amt = parseFloat(amount);
            const rate = parseFloat(tna);
            const days = parseInt(durationDays);
            if (!isNaN(amt) && !isNaN(rate) && !isNaN(days)) {
                // Formula: Capital * (TNA/100) * (Days/365)
                const interest = (amt * (rate / 100) * days) / 365;
                setEstimatedInterest(interest);
            } else {
                setEstimatedInterest(0);
            }
        } else {
            setEstimatedInterest(0);
        }
    }, [type, amount, tna, durationDays]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = initialData ? `/api/bank-investments/${initialData.id}` : '/api/bank-investments';
            const method = initialData ? 'PUT' : 'POST';

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    alias, // Sending empty or current state
                    amount,
                    currency,
                    startDate: type === 'PLAZO_FIJO' ? startDate : null,
                    durationDays: type === 'PLAZO_FIJO' ? durationDays : null,
                    tna: type === 'PLAZO_FIJO' ? tna : null
                })
            });
            onSaved();

            // Reset form if creating new
            if (!initialData) {
                setAlias('');
                setAmount('');
                setTna('');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
            {/* Type Selection */}
            <div className="space-y-2">
                <Label className="text-white">Tipo de Operación</Label>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-700 text-white z-[9999]">
                        <SelectItem value="PLAZO_FIJO" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Plazo Fijo</SelectItem>
                        <SelectItem value="FCI" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Fondo Común de Inversión</SelectItem>
                        <SelectItem value="CAJA_SEGURIDAD" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Caja de Seguridad</SelectItem>
                        <SelectItem value="CAJA_AHORRO" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Caja de Ahorro</SelectItem>
                        <SelectItem value="OTRO" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Otro (Personalizado)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-white">Nombre / Alias (Ej. Galicia, Santander)</Label>
                <Input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Ej. Galicia"
                    className="bg-slate-800 border-slate-700 text-white"
                />
            </div>

            {/* Common Fields */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-white">Moneda</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border-slate-700 text-white z-[9999]">
                            <SelectItem value="USD" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Dólares (USD)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-white">Monto Invertido</Label>
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="bg-slate-800 border-slate-700 font-bold text-white"
                    />
                </div>
            </div>

            {/* Plazo Fijo Specifics */}
            {type === 'PLAZO_FIJO' && (
                <div className="space-y-4 border-t border-slate-800 pt-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-white">Fecha Constitución</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">Plazo (Días)</Label>
                            <Input
                                type="number"
                                value={durationDays}
                                onChange={(e) => setDurationDays(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                            {startDate && durationDays && (
                                <div className="text-right text-[10px] text-blue-400 mt-1 font-mono">
                                    Vence: {(() => {
                                        try {
                                            const [y, m, d] = startDate.split('-').map(Number);
                                            // Create date at noon to avoid timezone overlaps
                                            const start = new Date(y, m - 1, d, 12, 0, 0);
                                            const end = addDays(start, parseInt(durationDays));
                                            return format(end, 'dd/MM/yyyy');
                                        } catch { return '-'; }
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-white">Tasa Nominal Anual (TNA %)</Label>
                        <Input
                            type="number"
                            value={tna}
                            onChange={(e) => setTna(e.target.value)}
                            placeholder="Ej. 35.5"
                            className="bg-slate-800 border-slate-700 text-white"
                        />
                    </div>

                    {/* Live Calculation Preview */}
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center text-slate-400 text-sm">
                            <Calculator className="w-4 h-4 mr-2" />
                            Interés Estimado:
                        </div>
                        <div className="text-emerald-400 font-bold">
                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(estimatedInterest)}
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
                    {loading ? 'Guardando...' : initialData ? 'Actualizar' : 'Confirmar Operación'}
                </Button>
            </div>
        </form>
    );
}
