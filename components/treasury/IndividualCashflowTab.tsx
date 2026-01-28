'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Eye, EyeOff, PlusCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface Treasury {
    id: string;
    ticker: string;
    name: string;
    type: string;
}

interface Cashflow {
    id: string;
    date: string;
    amount: number;
    type: string;
    description: string;
    capitalResidual?: number;
}

interface Transaction {
    id: string;
    date: string;
    quantity: number;
    price: number;
    totalAmount: number;
    type: 'BUY' | 'SELL';
}

interface MergedItem {
    id: string;
    date: string;
    type: 'BUY' | 'SELL' | 'INTEREST' | 'AMORTIZATION';
    description: string;
    amount: number;
    quantity?: number;
    price?: number;
    isTransaction: boolean;
    runningBalance: number;
}

export function IndividualCashflowTab() {
    const [treasuries, setTreasuries] = useState<Treasury[]>([]);
    const [selectedTreasury, setSelectedTreasury] = useState('');
    const [cashflows, setCashflows] = useState<Cashflow[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        loadTreasuries();
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }
    }, []);

    useEffect(() => {
        if (selectedTreasury) {
            loadData(selectedTreasury);
        } else {
            setCashflows([]);
            setTransactions([]);
        }
    }, [selectedTreasury]);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
    };

    const loadTreasuries = async () => {
        try {
            const res = await fetch('/api/investments/treasury', { cache: 'no-store' });
            const data = await res.json();

            // Filter only Treasuries (exclude ETFs)
            // Ensure type comparison is case-insensitive just in case
            const onlyTreasuries = data.filter((t: any) => t.type && t.type.toUpperCase() === 'TREASURY');

            setTreasuries(onlyTreasuries);

            if (onlyTreasuries.length > 0 && !selectedTreasury) {
                setSelectedTreasury(onlyTreasuries[0].id);
            }
        } catch (error) {
            console.error('Error loading Treasuries:', error);
        }
    };

    const loadData = async (id: string) => {
        setLoading(true);
        try {
            const [resCf, resTx] = await Promise.all([
                fetch(`/api/investments/treasury/${id}/cashflows`),
                fetch(`/api/investments/treasury/${id}/transactions`)
            ]);

            const dataCf = await resCf.json();
            const dataTx = await resTx.json();

            setCashflows(dataCf);
            setTransactions(dataTx);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount: number) => {
        if (!showValues) return '****';
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatNumber = (num: number) => {
        if (!showValues) return '****';
        return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const getMergedData = (): MergedItem[] => {
        const merged: MergedItem[] = [];

        transactions.forEach(tx => {
            merged.push({
                id: tx.id,
                date: tx.date,
                type: 'BUY',
                description: `Compra de ${tx.quantity} nominales`,
                amount: -Math.abs(tx.totalAmount),
                quantity: tx.quantity,
                price: tx.price,
                isTransaction: true,
                runningBalance: 0
            });
        });

        cashflows.forEach(cf => {
            merged.push({
                id: cf.id,
                date: cf.date,
                type: cf.type as any,
                description: cf.description,
                amount: cf.amount,
                isTransaction: false,
                runningBalance: 0
            });
        });

        merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let currentNominales = 0;
        return merged.map(item => {
            if (item.type === 'BUY') {
                currentNominales += (item.quantity || 0);
            } else if (item.type === 'AMORTIZATION') {
                currentNominales -= item.amount;
            }
            currentNominales = Math.round(currentNominales * 100) / 100;

            return {
                ...item,
                runningBalance: currentNominales
            };
        });
    };

    const mergedData = getMergedData();

    return (
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <span>Flujo de Fondos por Treasury</span>
                        <select
                            value={selectedTreasury}
                            onChange={(e) => setSelectedTreasury(e.target.value)}
                            className="px-3 py-1 bg-slate-700 border border-slate-600 rounded-md text-white text-sm font-normal"
                        >
                            <option value="">Seleccionar Treasury...</option>
                            {treasuries.map(treasury => (
                                <option key={treasury.id} value={treasury.id}>
                                    {treasury.ticker} - {treasury.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={togglePrivacy}
                            className="p-2 bg-slate-700 rounded-md text-slate-300 hover:text-white"
                            title={showValues ? "Ocultar montos" : "Mostrar montos"}
                        >
                            {showValues ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </CardTitle>
                <CardDescription className="text-slate-300">
                    Visualiza compras y flujo de fondos unificado
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!selectedTreasury ? (
                    <div className="text-slate-400 text-center py-12">
                        Selecciona un Treasury para ver su detalle
                    </div>
                ) : loading ? (
                    <div className="text-slate-400 text-center py-12">Cargando...</div>
                ) : mergedData.length === 0 ? (
                    <div className="text-slate-400 text-center py-12">
                        No hay movimientos registrados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-4 text-white font-normal">Fecha</th>
                                    <th className="text-left py-3 px-4 text-white font-normal">Concepto</th>
                                    <th className="text-right py-3 px-4 text-white font-normal">Monto</th>
                                    <th className="text-right py-3 px-4 text-white font-normal">Saldo Nominales</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mergedData.map((item, idx) => (
                                    <tr key={`${item.id}-${idx}`} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-3 px-4 text-white">
                                            {format(new Date(item.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="py-3 px-4 text-white">
                                            <div className="flex items-center gap-2">
                                                {item.type === 'BUY' && <PlusCircle size={16} className="text-purple-400" />}
                                                {item.type === 'INTEREST' && <ArrowUpCircle size={16} className="text-green-400" />}
                                                {item.type === 'AMORTIZATION' && <ArrowDownCircle size={16} className="text-blue-400" />}

                                                <span className={`px-2 py-1 rounded text-xs ${item.type === 'BUY' ? 'bg-purple-500/20 text-purple-300' :
                                                    item.type === 'INTEREST' ? 'bg-green-500/20 text-green-300' :
                                                        'bg-blue-500/20 text-blue-300'
                                                    }`}>
                                                    {item.type === 'BUY' ? 'COMPRA' :
                                                        item.type === 'INTEREST' ? 'INTERÉS' : 'AMORTIZACIÓN'}
                                                </span>
                                                <span className="text-sm text-slate-300">{item.description}</span>
                                            </div>
                                        </td>
                                        <td className={`py-3 px-4 text-right font-mono ${item.amount > 0 ? 'text-green-400' :
                                            item.amount < 0 ? 'text-red-400' : 'text-white'
                                            }`}>
                                            {formatMoney(item.amount)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-400 text-right font-mono">
                                            {formatNumber(item.runningBalance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
