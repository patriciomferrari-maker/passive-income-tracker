'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Eye, EyeOff, PlusCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Ensure Button is imported

interface ON {
    id: string;
    ticker: string;
    name: string;
    currency?: string;
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
    currency: string;             // ARS or USD
    type: 'BUY' | 'SELL';
}

interface MergedItem {
    id: string;
    date: string;
    type: 'BUY' | 'SELL' | 'INTEREST' | 'AMORTIZATION';
    description: string;
    amount: number; // Display Amount (possibly converted)
    originalAmount: number;
    currency: string; // The currency of the displayed amount
    originalCurrency: string;
    quantity?: number; // For transactions
    price?: number; // For transactions
    isTransaction: boolean;
    runningBalance: number;
}

export function IndividualCashflowTab() {
    const [ons, setOns] = useState<ON[]>([]);
    const [selectedON, setSelectedON] = useState('');
    const [cashflows, setCashflows] = useState<Cashflow[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    // Currency & Rates
    const [currencyMode, setCurrencyMode] = useState<'ORIGINAL' | 'USD'>('ORIGINAL');
    const [rates, setRates] = useState<Record<string, number>>({});

    // Privacy Mode
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        loadONs();
        fetchRates();
        // Load privacy setting
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }
    }, []);

    useEffect(() => {
        if (selectedON) {
            loadData(selectedON);
        } else {
            setCashflows([]);
            setTransactions([]);
        }
    }, [selectedON]);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
    };

    const loadONs = async () => {
        try {
            const res = await fetch('/api/investments/on');
            const data = await res.json();
            // Filter only ONs and Bonds, and those with transactions
            const onsWithPurchases = data.filter((on: any) =>
                (on._count && on._count.transactions > 0) &&
                (on.type === 'ON' || on.type === 'CORPORATE_BOND')
            );
            setOns(onsWithPurchases);

            if (onsWithPurchases.length > 0 && !selectedON) {
                setSelectedON(onsWithPurchases[0].id);
            }
        } catch (error) {
            console.error('Error loading ONs:', error);
        }
    };

    const fetchRates = async () => {
        try {
            const res = await fetch('/api/economic-data/history?type=TC_USD_ARS');
            if (res.ok) {
                const data = await res.json();
                setRates(data);
            }
        } catch (error) {
            console.error('Error fetching rates:', error);
        }
    };

    const loadData = async (id: string) => {
        setLoading(true);
        try {
            // Load Cashflows
            const resCf = await fetch(`/api/investments/on/${id}/cashflows`);
            const dataCf = await resCf.json();
            setCashflows(dataCf);

            // Load Transactions (Purchases)
            const resTx = await fetch(`/api/investments/on/${id}/transactions`);
            const dataTx = await resTx.json();
            setTransactions(dataTx);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getExchangeRate = (dateStr: string): number => {
        // Try exact match
        if (rates[dateStr]) return rates[dateStr];

        // Try finding closest previous date
        // Since rates keys are YYYY-MM-DD, we can sort and find.
        // But for performance, assuming keys are roughly continuous.
        // Let's just fallback to a recent rate if exact missing.
        // Quick & Dirty: Iterate back 7 days?
        const d = new Date(dateStr);
        for (let i = 0; i < 7; i++) {
            const iso = d.toISOString().split('T')[0];
            if (rates[iso]) return rates[iso];
            d.setDate(d.getDate() - 1);
        }

        // Fallback to latest
        return 1200;
    };

    const formatMoney = (amount: number, currency: string) => {
        if (!showValues) return '****';
        return Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    };

    const formatNumber = (num: number) => {
        if (!showValues) return '****';
        return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    // Merge and Process Data
    const getMergedData = () => {
        const merged: MergedItem[] = [];

        // Add Transactions
        transactions.forEach(tx => {
            const dateStr = new Date(tx.date).toISOString().split('T')[0];
            let amount = -Math.abs(tx.totalAmount);
            let currency = tx.currency;

            // Conversion Logic
            if (currencyMode === 'USD' && tx.currency === 'ARS') {
                const rate = getExchangeRate(dateStr);
                amount = amount / rate;
                currency = 'USD';
            }

            merged.push({
                id: tx.id,
                date: tx.date,
                type: 'BUY',
                description: `Compra de ${tx.quantity} nominales`,
                amount: amount,
                originalAmount: -Math.abs(tx.totalAmount),
                currency: currency,
                originalCurrency: tx.currency,
                quantity: tx.quantity,
                price: tx.price,
                isTransaction: true,
                runningBalance: 0 // Calc later
            });
        });

        // Add Cashflows
        cashflows.forEach(cf => {
            // Assume Cashflows are in USD (Investment Currency)
            // If we ever support ARS ONs, we might need logic here.
            // For now, treat as USD.
            merged.push({
                id: cf.id,
                date: cf.date,
                type: cf.type as any,
                description: cf.description,
                amount: cf.amount,
                originalAmount: cf.amount,
                currency: 'USD',
                originalCurrency: 'USD',
                isTransaction: false,
                runningBalance: 0
            });
        });

        // Sort by Date
        merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate Running Balances (Nominales Residuales)
        let currentNominales = 0;

        const processed = merged.map(item => {
            if (item.type === 'BUY') {
                currentNominales += (item.quantity || 0);
            } else if (item.type === 'AMORTIZATION') {
                // Amortization amount (in USD) reduces the Nominal Principle
                // We use originalAmount if available, assuming it matches Nominals 1:1
                // For USD ONs, Amount in USD = Nominals Amortized.
                currentNominales -= Math.abs(item.type === 'AMORTIZATION' ? item.originalAmount : 0);
            }

            // Round to avoid floating point errors
            currentNominales = Math.round(currentNominales * 100) / 100;

            return {
                ...item,
                runningBalance: currentNominales
            };
        });

        return processed;
    };

    const mergedData = getMergedData();

    return (
        <Card className="bg-slate-950 border-slate-800">
            <CardHeader>
                <CardTitle className="text-white flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <span>Flujo de Fondos por ON</span>
                        <select
                            value={selectedON}
                            onChange={(e) => setSelectedON(e.target.value)}
                            className="px-3 py-1 bg-slate-700 border border-slate-600 rounded-md text-white text-sm font-normal"
                        >
                            <option value="">Seleccionar ON...</option>
                            {ons.map(on => (
                                <option key={on.id} value={on.id}>
                                    {on.ticker} - {on.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Currency Toggle */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                            <button
                                onClick={() => setCurrencyMode('ORIGINAL')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${currencyMode === 'ORIGINAL'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                Original (Mix)
                            </button>
                            <button
                                onClick={() => setCurrencyMode('USD')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${currencyMode === 'USD'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                USD Unificado
                            </button>
                        </div>

                        <button
                            onClick={togglePrivacy}
                            className="p-2 bg-slate-700 rounded-md text-slate-300 hover:text-white"
                            title={showValues ? "Ocultar montos" : "Mostrar montos"}
                        >
                            {showValues ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </CardTitle>
                <CardDescription className="text-slate-300 flex items-center gap-4">
                    Visualiza compras y flujo de fondos unificado

                </CardDescription>
            </CardHeader>
            <CardContent>
                {!selectedON ? (
                    <div className="text-slate-400 text-center py-12">
                        Selecciona una ON para ver su detalle
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
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Fecha</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Concepto</th>
                                    <th className="text-right py-3 px-4 text-slate-300 font-medium">Monto</th>
                                    <th className="text-right py-3 px-4 text-slate-300 font-medium">Saldo Nominales</th>
                                    <th className="text-right py-3 px-4 text-slate-500 font-medium text-xs">Moneda</th>
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
                                        <td className={`py-3 px-4 text-right font-mono ${item.amount > 0 ? 'text-green-400' : item.amount < 0 ? 'text-red-400' : 'text-white'}`}>
                                            {formatMoney(item.amount, item.currency)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-400 text-right font-mono">
                                            {formatNumber(item.runningBalance)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 text-right text-xs">
                                            {item.currency}
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
