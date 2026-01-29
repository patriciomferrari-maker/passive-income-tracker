'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Eye, EyeOff, PlusCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface ON {
    id: string;
    ticker: string;
    name: string;
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
    amount: number; // Cash flow amount (negative for buy, positive for sell/interest/amort)
    quantity?: number; // For transactions
    price?: number; // For transactions
    isTransaction: boolean;
    originalData: any;
}

export function IndividualCashflowTab() {
    const [ons, setOns] = useState<ON[]>([]);
    const [selectedON, setSelectedON] = useState('');
    const [cashflows, setCashflows] = useState<Cashflow[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewCurrency, setViewCurrency] = useState<'ARS' | 'USD'>('USD'); // DEFAULT: USD


    // Privacy Mode
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        loadONs();
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
    }, [selectedON, viewCurrency]); // Reload when currency changes

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
    };

    const loadONs = async () => {
        try {
            const res = await fetch('/api/investments/on');
            const data = await res.json();
            if (!Array.isArray(data)) {
                console.error('ONs API returned non-array data:', data);
                setOns([]);
                return;
            }
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

    const loadData = async (id: string) => {
        setLoading(true);
        try {
            // Load Investment details
            const resInv = await fetch(`/api/investments/on/${id}`);
            if (!resInv.ok) {
                console.error('Failed to load investment');
                return;
            }
            const investment = await resInv.json();
            const investmentCurrency = investment?.currency || 'USD';

            console.log(`Loading data for ${investment.ticker}, Investment Currency: ${investmentCurrency}, View Currency: ${viewCurrency}`);

            // ALWAYS load Exchange Rates (cashflows may have different currency than investment)
            const resRates = await fetch('/api/economic-data/tc');
            const ratesData = await resRates.json();
            const exchangeRates: Record<string, number> = {};
            if (Array.isArray(ratesData)) {
                ratesData.forEach((r: any) => {
                    const dateKey = new Date(r.date).toISOString().split('T')[0];
                    exchangeRates[dateKey] = r.value;
                });
            }

            // Helper to get exchange rate for a date
            const getRate = (date: string) => {
                if (Object.keys(exchangeRates).length === 0) return 1; // No rates available
                const dateKey = new Date(date).toISOString().split('T')[0];
                if (exchangeRates[dateKey]) return exchangeRates[dateKey];
                // Fallback: find closest past date
                const sortedDates = Object.keys(exchangeRates).sort();
                const closestDate = sortedDates.reverse().find(d => d <= dateKey);
                return closestDate ? exchangeRates[closestDate] : 1200; // Fallback rate
            };

            // Load Cashflows  
            const resCf = await fetch(`/api/investments/on/${id}/cashflows`);
            const dataCf = await resCf.json();

            if (!Array.isArray(dataCf)) {
                console.error('Cashflows API returned non-array data:', dataCf);
                setCashflows([]);
                setTransactions([]); // Also reset transactions as they are linked
                return;
            }

            console.log('🔍 CASHFLOW DEBUG:');
            console.log(`Total cashflows: ${dataCf.length}`);
            if (dataCf.length > 0) {
                console.log('First 3 cashflows:', dataCf.slice(0, 3).map((cf: any) => ({
                    date: cf.date,
                    amount: cf.amount,
                    currency: cf.currency,
                    type: cf.type
                })));
            }

            // Convert cashflows if needed - USE cashflow.currency, not investment currency
            const convertedCf = dataCf.map((cf: any) => {
                let amount = cf.amount;
                const cfCurrency = cf.currency || investmentCurrency; // Fallback to investment currency if not set

                console.log(`CF: ${cf.type} | DB: ${cf.currency} | Resolved: ${cfCurrency} | View: ${viewCurrency} | Will convert: ${cfCurrency !== viewCurrency}`);

                if (cfCurrency !== viewCurrency && amount !== 0) {
                    const rate = getRate(cf.date);
                    const originalAmount = amount;
                    if (cfCurrency === 'ARS' && viewCurrency === 'USD') {
                        amount = amount / rate;
                    } else if (cfCurrency === 'USD' && viewCurrency === 'ARS') {
                        amount = amount * rate;
                    }
                    console.log(`  Converted: ${originalAmount} ${cfCurrency} → ${amount} ${viewCurrency} (rate: ${rate})`);
                }
                return { ...cf, amount, currency: viewCurrency };
            });
            setCashflows(convertedCf);

            // Load Transactions
            const resTx = await fetch(`/api/investments/on/${id}/transactions`);
            const dataTx = await resTx.json();

            if (!Array.isArray(dataTx)) {
                console.error('Transactions API returned non-array data:', dataTx);
                setTransactions([]);
                return;
            }

            // Convert transactions if needed
            const convertedTx = dataTx.map((tx: any) => {
                let totalAmount = tx.totalAmount;
                let price = tx.price;
                const txCurrency = tx.currency || investmentCurrency;

                if (txCurrency !== viewCurrency) {
                    const rate = getRate(tx.date);
                    if (txCurrency === 'ARS' && viewCurrency === 'USD') {
                        totalAmount = totalAmount / rate;
                        price = price / rate;
                    } else if (txCurrency === 'USD' && viewCurrency === 'ARS') {
                        totalAmount = totalAmount * rate;
                        price = price * rate;
                    }
                }
                return { ...tx, totalAmount, price, currency: viewCurrency };
            });
            setTransactions(convertedTx);

            console.log(`Loaded ${convertedCf.length} cashflows and ${convertedTx.length} transactions`);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };


    const formatMoney = (amount: number | null | undefined) => {
        if (!showValues) return '****';
        if (amount === null || amount === undefined || isNaN(amount)) return '-';

        try {
            return Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: viewCurrency || 'USD'
            }).format(amount);
        } catch (e) {
            console.error('Error formatting money:', e, { amount, currency: viewCurrency });
            return `${viewCurrency || 'USD'} ${amount.toFixed(2)}`;
        }
    };

    const formatNumber = (num: number | null | undefined) => {
        if (!showValues) return '****';
        if (num === null || num === undefined || isNaN(num)) return '-';
        return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    // Merge and Process Data
    const getMergedData = () => {
        const merged: MergedItem[] = [];

        // Add Transactions
        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                merged.push({
                    id: tx.id,
                    date: tx.date,
                    type: 'BUY', // Assuming only buys for now based on context
                    description: `Compra de ${tx.quantity} nominales`,
                    amount: -Math.abs(tx.totalAmount), // Outflow
                    quantity: tx.quantity,
                    price: tx.price,
                    isTransaction: true,
                    originalData: tx
                });
            });
        }

        // Add Cashflows
        if (Array.isArray(cashflows)) {
            cashflows.forEach(cf => {
                merged.push({
                    id: cf.id,
                    date: cf.date,
                    type: cf.type as any,
                    description: cf.description,
                    amount: cf.amount, // Inflow
                    isTransaction: false,
                    originalData: cf
                });
            });
        }

        // Sort by Date
        merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate Running Balances (Nominales Residuales)
        let currentNominales = 0;
        // We need to track the "Factor" to know how much Amortization reduces the Nominal Balance
        // But simpler: 
        // If it's a BUY, we add Quantity.
        // If it's AMORTIZATION, we need to know how much capital is being returned.
        // The 'amount' is $. The 'quantity' (holdings) doesn't change, but the 'residual value' changes.
        // The user wants "Nominales que va subir a medida que se hagan compras y bajar a medida que haya amortizaciones".
        // This means they want to track the "Outstanding Principal" (Capital Residual).

        // For AMORTIZATION: Amount = Holdings * Factor.
        // So Factor = Amount / Holdings.
        // And Capital Reduced = Amount.
        // So Capital Residual = Previous Capital Residual - Amount.

        // Let's track "Capital Residual" (Outstanding Principal in $)

        const processed = merged.map(item => {
            if (item.type === 'BUY') {
                // When buying, we add the Nominal Quantity. 
                // BUT, if the bond has already amortized, the "Capital Residual" added is Quantity * CurrentFactor.
                // However, usually you buy "Nominals". 
                // Let's assume for the "Running Balance" column, we want to show "Capital Residual" (Value of the principal held).

                // Actually, the user said "Nominales". 
                // "Nominales... bajar a medida que haya amortizaciones".
                // This is technically "Valor Residual".
                // If I have 1000 nominals, and 20% amortizes, I get $200. My "Valor Residual" drops by 200.

                // So:
                // Buy: + Quantity (assuming par or close to par, or just tracking face value? No, tracking residual).
                // Actually, if I buy 1000 nominals of a bond that has 50% residual, I am adding 500 to my Capital Residual.
                // But I don't easily know the factor at purchase time here without complex logic.

                // SIMPLIFICATION:
                // Track "Nominales" (Face Value) and "Capital Residual" separately?
                // User asked for ONE column.
                // "Nominales (que va subir... y bajar...)".
                // This behaves exactly like "Capital Residual".

                // Logic:
                // 1. Buy: Add Quantity (Assuming 100% factor? Or should we try to deduce?)
                //    If we assume the user buys "Nominals", we add Quantity.
                // 2. Amortization: Subtract the Amortization Amount?
                //    Yes, because Amortization is return of capital.
                //    If I have 1000 Capital, and get 200 Amortization, I have 800 Capital left.

                // There is a nuance: If I buy a bond that is already amortized, say factor 0.5.
                // I buy 1000 nominals. My "Capital Claim" is 500.
                // If I just add 1000, it's wrong.

                // However, without historical factor data here, it's hard.
                // BUT, `generateInvestmentCashflow` calculates `capitalResidual` for each cashflow row!
                // Let's use that!
                // The `cashflow` object has `capitalResidual`. This is the residual AFTER the payment.
                // So for Cashflow rows, we can just display that value.

                // What about Purchase rows?
                // We can interpolate?
                // Or just show "-" for purchases and let the next cashflow show the updated residual.

                // User wants to see it "go up" when buying.
                // If I show "-" for purchases, it doesn't "go up".

                // Let's try to maintain a running `currentResidual` state.
                // For BUY: We add `item.quantity`. (Assuming Factor=1 at purchase? This is a risk).
                // For AMORTIZATION: We subtract `item.amount`?
                //    If `item.amount` is the amortization payment.

                // BETTER APPROACH:
                // The `cashflows` from API *already* contain the correct `capitalResidual` calculated with full schedule knowledge.
                // We can just use the `capitalResidual` from the *next* cashflow (or previous?)
                // Actually, `cashflows` are projected.
                // If I have a purchase, the *next* cashflow will reflect that purchase in its `capitalResidual` calculation.
                // So, for the Purchase row itself, what do we show?
                // Maybe we can't show exact residual at purchase moment easily.

                // Alternative: Just show "Nominales" (Face Value).
                // Buy: +Quantity.
                // Amortization: No change.
                // This contradicts "bajar a medida que haya amortizaciones".

                // Alternative 2: "Capital Residual"
                // Buy: +Quantity (Approximate, assuming user buys Face Value, which is standard for "Quantity" input).
                // Amortization: -Amount.
                // This works if the bond hasn't amortized yet.
                // If it has, buying 1000 nominals adds 1000 to this counter, but should add less.

                // Let's stick to the user's request: "Nominales que sube con compras y baja con amortizaciones".
                // I will implement:
                // Balance = Balance + (Type == BUY ? Quantity : 0) - (Type == AMORTIZATION ? Amount : 0).
                // Note: Amortization Amount is in $. Quantity is in Nominals.
                // Usually 1 Nominal = $1 (or $100).
                // In Argentina ONs, usually 1 Nominal = 1 USD/ARS.
                // So subtracting Amount from Quantity works if currency matches.

                if (item.type === 'BUY') {
                    currentNominales += (item.quantity || 0);
                } else if (item.type === 'AMORTIZATION') {
                    // Amortization amount is the capital returned.
                    currentNominales -= item.amount;
                }

                // Round to avoid floating point errors
                currentNominales = Math.round(currentNominales * 100) / 100;
            }

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
                            {Array.isArray(ons) && ons.map(on => (
                                <option key={on.id} value={on.id}>
                                    {on.ticker} - {on.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Currency Toggle */}
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                            <button
                                onClick={() => setViewCurrency('ARS')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewCurrency === 'ARS'
                                    ? 'bg-blue-900/50 text-blue-200 border border-blue-800'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                ARS
                            </button>
                            <button
                                onClick={() => setViewCurrency('USD')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewCurrency === 'USD'
                                    ? 'bg-green-900/50 text-green-200 border border-green-800'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                USD
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

                                </tr>
                            </thead>
                            <tbody>
                                {mergedData.map((item, idx) => (
                                    <tr key={`${item.id}-${idx}`} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="py-3 px-4 text-white">
                                            {(() => {
                                                try {
                                                    return item.date ? format(new Date(item.date), 'dd/MM/yyyy') : '-';
                                                } catch (e) {
                                                    return '-';
                                                }
                                            })()}
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
