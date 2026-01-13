'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Banknote, PlusCircle, Calendar, PieChart, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import { EditTransactionDialog } from './EditTransactionDialog';

interface Debt {
    id: string;
    debtorName: string;
    initialAmount: number;
    currency: string;
    balance: number;
    startDate: string;
    details?: string;
}

interface Payment {
    id: string;
    amount: number;
    date: string;
    description: string;
    type: string; // 'PAYMENT' | 'INCREASE'
}

// Extended interface for display
interface TransactionRow {
    id: string;
    date: Date;
    type: 'INITIAL' | 'PAYMENT' | 'INCREASE';
    description: string;
    amount: number;
    runningBalance: number;
    currency: string;
}

interface TabProps {
    showValues?: boolean;
}

export function DebtsFlowTab({ showValues = true }: TabProps) {
    const [debts, setDebts] = useState<Debt[]>([]);
    const [selectedDebtId, setSelectedDebtId] = useState('');
    const [debtPayments, setDebtPayments] = useState<Payment[]>([]);
    const [editingTransaction, setEditingTransaction] = useState<any>(null);

    // State for collapsed groups (Default expanded: empty map means all consistent)
    const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({});
    const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadDebts();
    }, []);

    useEffect(() => {
        if (debts.length > 0 && !selectedDebtId) {
            setSelectedDebtId(debts[0].id);
        }
    }, [debts]);

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

    const handleSaveTransaction = async (id: string, data: any) => {
        const res = await fetch(`/api/debts/payments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            if (selectedDebtId) loadPayments(selectedDebtId);
        } else {
            throw new Error('Failed to update');
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        const res = await fetch(`/api/debts/payments/${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            if (selectedDebtId) loadPayments(selectedDebtId);
        } else {
            throw new Error('Failed to delete');
        }
    };

    const toggleYear = (year: string) => {
        setCollapsedYears(prev => ({ ...prev, [year]: !prev[year] }));
    };

    const toggleMonth = (yearMonthKey: string) => {
        setCollapsedMonths(prev => ({ ...prev, [yearMonthKey]: !prev[yearMonthKey] }));
    };

    const selectedDebt = debts.find(d => d.id === selectedDebtId);

    const formatCurrency = (val: number, currency: string) => {
        if (!showValues) return '****';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);
    };

    const formatPercentage = (val: number) => {
        if (!showValues) return '****';
        return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(val);
    };

    // --- Data Processing & Calculation Memoized ---
    const processedData = useMemo(() => {
        if (!selectedDebt) return { transactionRows: [], grouped: {}, years: [] };

        const sortedPayments = [...debtPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const transactionRows: TransactionRow[] = [];
        let currentBalance = selectedDebt.initialAmount;

        transactionRows.push({
            id: 'initial',
            date: new Date(selectedDebt.startDate),
            type: 'INITIAL',
            description: selectedDebt.details || 'Deuda Original',
            amount: selectedDebt.initialAmount,
            runningBalance: currentBalance,
            currency: selectedDebt.currency
        });

        sortedPayments.forEach(p => {
            if (p.type === 'INCREASE') {
                currentBalance += p.amount;
            } else {
                currentBalance -= p.amount;
            }
            transactionRows.push({
                id: p.id,
                date: new Date(p.date),
                type: p.type as 'PAYMENT' | 'INCREASE',
                description: p.description,
                amount: p.amount,
                runningBalance: currentBalance,
                currency: selectedDebt.currency
            });
        });

        const grouped: any = {};
        const yearsSet = new Set<string>();

        transactionRows.forEach(row => {
            const year = row.date.getUTCFullYear().toString();
            const month = row.date.getUTCMonth().toString();

            yearsSet.add(year);

            if (!grouped[year]) {
                grouped[year] = {
                    totalLoans: 0,
                    totalPayments: 0,
                    months: {},
                    closingBalance: 0
                };
            }
            if (!grouped[year].months[month]) {
                grouped[year].months[month] = {
                    totalLoans: 0,
                    totalPayments: 0,
                    rows: [],
                    closingBalance: 0
                };
            }

            grouped[year].months[month].rows.push(row);

            if (row.type === 'INITIAL' || row.type === 'INCREASE') {
                grouped[year].totalLoans += row.amount;
                grouped[year].months[month].totalLoans += row.amount;
            } else if (row.type === 'PAYMENT') {
                grouped[year].totalPayments += row.amount;
                grouped[year].months[month].totalPayments += row.amount;
            }

            // Since we iterate chronologically, the last row of the group sets the latest balance
            grouped[year].closingBalance = row.runningBalance;
            grouped[year].months[month].closingBalance = row.runningBalance;
        });

        const sortedYears = Array.from(yearsSet).sort();

        return {
            transactionRows,
            grouped,
            years: sortedYears
        };

    }, [selectedDebt, debtPayments]);

    // Derived Stats
    const totalLoaned = processedData.transactionRows
        .filter(p => p.type === 'INCREASE')
        .reduce((sum, p) => sum + p.amount, 0);
    const totalPrincipal = (selectedDebt?.initialAmount || 0) + totalLoaned;
    const totalRepaid = processedData.transactionRows
        .filter(p => p.type === 'PAYMENT')
        .reduce((sum, p) => sum + p.amount, 0);
    const repaymentProgress = totalPrincipal > 0 ? totalRepaid / totalPrincipal : 0;

    const getMonthName = (monthIndex: string) => {
        const date = new Date();
        date.setMonth(parseInt(monthIndex));
        return date.toLocaleString('es-AR', { month: 'long' });
    };

    const formatDateShort = (date: Date) => {
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Flujo de Deudas</h2>

            <div className="max-w-md">
                <div className="relative">
                    <select
                        className="w-full h-10 bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500 appearance-none cursor-pointer"
                        value={selectedDebtId}
                        onChange={(e) => setSelectedDebtId(e.target.value)}
                    >
                        <option value="" disabled>Seleccionar Deudor para ver detalles...</option>
                        {debts.map(debt => (
                            <option key={debt.id} value={debt.id} className="bg-slate-900 text-white">
                                {debt.debtorName}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none">
                        <ChevronDown className="lucide lucide-chevron-down opacity-50" size={16} />
                    </div>
                </div>
            </div>

            {!selectedDebt ? (
                <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Cargando información...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-slate-950 border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-400">Total Prestado</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">
                                    {formatCurrency(totalPrincipal, selectedDebt.currency)}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <Calendar size={12} />
                                    Inicio: {new Date(selectedDebt.startDate).toLocaleDateString('es-AR')}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950 border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-400">Avance de Cobro</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${repaymentProgress >= 1 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                    {formatPercentage(repaymentProgress)}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <PieChart size={12} />
                                    % del capital recuperado
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950 border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-400">Total Cobrado</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-400">
                                    {formatCurrency(totalRepaid, selectedDebt.currency)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Recuperado (Entradas)
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-950 border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-slate-400">A Cobrar</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-rose-400">
                                    {formatCurrency(selectedDebt.balance, selectedDebt.currency)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Saldo pendiente
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-slate-950 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <History size={20} className="text-blue-500" />
                                Flujo de Movimientos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border border-slate-800 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-900 border-b border-slate-800">
                                        <tr className="text-left text-slate-400">
                                            <th className="py-3 px-4 font-medium w-48">Fecha / Período</th>
                                            <th className="py-3 px-4 font-medium">Concepto</th>
                                            <th className="py-3 px-4 font-medium text-right text-rose-400">Préstamos (-)</th>
                                            <th className="py-3 px-4 font-medium text-right text-emerald-400">Pagos (+)</th>
                                            <th className="py-3 px-4 font-medium text-right text-slate-300">Saldo</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-slate-950">
                                        {processedData.years.length === 0 ? (
                                            <tr><td colSpan={6} className="py-8 text-center text-slate-500">Sin movimientos</td></tr>
                                        ) : (
                                            processedData.years.map(year => {
                                                const yearData = processedData.grouped[year];
                                                // Inverse logic: show if NOT collapsed (Default TRUE)
                                                const isYearExpanded = !collapsedYears[year];
                                                const sortedMonths = Object.keys(yearData.months).sort((a, b) => parseInt(a) - parseInt(b));

                                                return (
                                                    <React.Fragment key={year}>
                                                        <tr
                                                            className="bg-slate-900/80 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors"
                                                            onClick={() => toggleYear(year)}
                                                        >
                                                            <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                                                                {isYearExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                {year}
                                                            </td>
                                                            <td className="py-3 px-4 text-slate-500 text-xs uppercase tracking-wider font-semibold">Resumen Anual</td>
                                                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-500 bg-rose-950/10">
                                                                {yearData.totalLoans > 0 && formatCurrency(yearData.totalLoans, selectedDebt.currency)}
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500 bg-emerald-950/10">
                                                                {yearData.totalPayments > 0 && formatCurrency(yearData.totalPayments, selectedDebt.currency)}
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-400">
                                                                {formatCurrency(yearData.closingBalance, selectedDebt.currency)}
                                                            </td>
                                                            <td></td>
                                                        </tr>

                                                        {isYearExpanded && sortedMonths.map(month => {
                                                            const monthData = yearData.months[month];
                                                            const yearMonthKey = `${year}-${month}`;
                                                            // Inverse logic: show if NOT collapsed (Default TRUE)
                                                            const isMonthExpanded = !collapsedMonths[yearMonthKey];

                                                            return (
                                                                <React.Fragment key={yearMonthKey}>
                                                                    <tr
                                                                        className="bg-slate-900/30 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors"
                                                                        onClick={() => toggleMonth(yearMonthKey)}
                                                                    >
                                                                        <td className="py-2 px-4 pl-10 font-medium text-slate-300 flex items-center gap-2">
                                                                            {isMonthExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                            {getMonthName(month)}
                                                                        </td>
                                                                        <td className="py-2 px-4 text-slate-600 text-xs">Resumen Mensual</td>
                                                                        <td className="py-2 px-4 text-right font-mono text-sm text-rose-400/80">
                                                                            {monthData.totalLoans > 0 && formatCurrency(monthData.totalLoans, selectedDebt.currency)}
                                                                        </td>
                                                                        <td className="py-2 px-4 text-right font-mono text-sm text-emerald-400/80">
                                                                            {monthData.totalPayments > 0 && formatCurrency(monthData.totalPayments, selectedDebt.currency)}
                                                                        </td>
                                                                        <td className="py-2 px-4 text-right font-mono text-xs text-slate-500">
                                                                            {formatCurrency(monthData.closingBalance, selectedDebt.currency)}
                                                                        </td>
                                                                        <td></td>
                                                                    </tr>

                                                                    {isMonthExpanded && monthData.rows.map((row: TransactionRow) => (
                                                                        <tr key={row.id} className="border-b border-slate-800/30 hover:bg-slate-900/80 group transition-colors">
                                                                            <td className="py-3 px-4 pl-16 text-slate-400 text-xs font-mono">
                                                                                {formatDateShort(row.date)}
                                                                            </td>
                                                                            <td className="py-3 px-4 text-white">
                                                                                <div className="flex items-center gap-2">
                                                                                    {row.type === 'INITIAL' && <PlusCircle size={14} className="text-rose-500" />}
                                                                                    {row.type === 'INCREASE' && <PlusCircle size={14} className="text-amber-500" />}
                                                                                    {row.type === 'PAYMENT' && <Banknote size={14} className="text-emerald-500" />}
                                                                                    <span className="text-sm">{row.description || '-'}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-3 px-4 text-right font-mono font-medium text-rose-400 text-sm">
                                                                                {(row.type === 'INITIAL' || row.type === 'INCREASE')
                                                                                    ? formatCurrency(row.amount, row.currency)
                                                                                    : ''
                                                                                }
                                                                            </td>
                                                                            <td className="py-3 px-4 text-right font-mono font-medium text-emerald-400 text-sm">
                                                                                {row.type === 'PAYMENT'
                                                                                    ? formatCurrency(row.amount, row.currency)
                                                                                    : ''
                                                                                }
                                                                            </td>
                                                                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-300 text-sm">
                                                                                {formatCurrency(row.runningBalance, row.currency)}
                                                                            </td>
                                                                            <td className="py-3 px-4 text-right">
                                                                                {row.type !== 'INITIAL' && (
                                                                                    <button
                                                                                        className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-800"
                                                                                        onClick={(e) => { e.stopPropagation(); setEditingTransaction(row); }}
                                                                                        title="Editar"
                                                                                    >
                                                                                        <Pencil size={14} />
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <EditTransactionDialog
                        isOpen={!!editingTransaction}
                        onClose={() => setEditingTransaction(null)}
                        onSave={handleSaveTransaction}
                        onDelete={handleDeleteTransaction}
                        transaction={editingTransaction}
                    />
                </div>
            )}
        </div>
    );
}
