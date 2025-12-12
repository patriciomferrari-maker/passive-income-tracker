'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Building2,
    Calendar,
    TrendingUp,
    AlertCircle,
    Percent,
    Clock,
    DollarSign,
    RefreshCw
} from 'lucide-react';

interface Contract {
    id: string;
    tenantName: string | null;
    startDate: string;
    durationMonths: number;
    initialRent: number;
    currency: string;
    adjustmentType: string;
    adjustmentFrequency: number;
    property: {
        name: string;
    };
}

interface Cashflow {
    id: string;
    date: string;
    monthIndex: number;
    amountARS: number | null;
    amountUSD: number | null;
    ipcMonthly: number | null;
    ipcAccumulated: number | null;
    tc: number | null;
    tcBase: number | null;
    tcClosingMonth: number | null;
    inflationAccum: number | null;
    devaluationAccum: number | null;
}

export function IndividualCashflowTab({ showValues = true }: { showValues?: boolean }) {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [selectedContractId, setSelectedContractId] = useState('');
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [cashflows, setCashflows] = useState<Cashflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCashflows, setLoadingCashflows] = useState(false);

    useEffect(() => {
        loadContracts();
    }, []);

    useEffect(() => {
        if (selectedContractId) {
            loadCashflows(selectedContractId);
        }
    }, [selectedContractId]);

    const loadContracts = async () => {
        try {
            const res = await fetch('/api/rentals/contracts');
            const data = await res.json();
            if (Array.isArray(data)) {
                setContracts(data);
                if (data.length > 0 && !selectedContractId) {
                    setSelectedContractId(data[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading contracts:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCashflows = async (contractId: string) => {
        setLoadingCashflows(true);
        try {
            const contractRes = await fetch(`/api/rentals/contracts/${contractId}`);
            const contractData = await contractRes.json();
            setSelectedContract(contractData);

            const cashflowsRes = await fetch(`/api/rentals/contracts/${contractId}/cashflows`);
            const cashflowsData = await cashflowsRes.json();
            if (Array.isArray(cashflowsData)) {
                setCashflows(cashflowsData);
            }
        } catch (error) {
            console.error('Error loading cashflows:', error);
        } finally {
            setLoadingCashflows(false);
        }
    };



    const formatCurrency = (value: number | null, currency: string = 'ARS') => {
        if (value === null) return '-';
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatPercent = (value: number | null) => {
        if (value === null) return '-';
        return `${(value * 100).toFixed(2)}%`;
    };

    const contractMetrics = useMemo(() => {
        if (!selectedContract) return null;

        const start = new Date(selectedContract.startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + selectedContract.durationMonths);

        const now = new Date();

        // Months to Expiration
        let monthsToExpiration = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
        if (now.getDate() < start.getDate()) monthsToExpiration += 1;

        // Find Current Value
        const currentCf = cashflows.find(c => {
            const d = new Date(c.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        let currentValue = selectedContract.initialRent;
        if (currentCf) {
            currentValue = selectedContract.currency === 'ARS' ? (currentCf.amountARS || 0) : (currentCf.amountUSD || 0);
        } else if (cashflows.length > 0) {
            const pastCfs = cashflows.filter(c => new Date(c.date) <= now);
            if (pastCfs.length > 0) {
                const last = pastCfs[pastCfs.length - 1];
                currentValue = selectedContract.currency === 'ARS' ? (last.amountARS || 0) : (last.amountUSD || 0);
            }
        }

        // Growth Percentage
        const growthPercentage = selectedContract.initialRent > 0
            ? ((currentValue - selectedContract.initialRent) / selectedContract.initialRent)
            : 0;

        // Next Adjustment
        let nextAdjDate: Date | null = null;
        let monthsToNextAdj: number | null = null;

        if (selectedContract.adjustmentType === 'IPC') {
            const freq = selectedContract.adjustmentFrequency || 12;
            let checkDate = new Date(start);
            while (checkDate <= now) {
                checkDate.setMonth(checkDate.getMonth() + freq);
            }
            nextAdjDate = checkDate;
            monthsToNextAdj = (nextAdjDate.getFullYear() - now.getFullYear()) * 12 + (nextAdjDate.getMonth() - now.getMonth());
        }

        const validInflation = [...cashflows].reverse().find(c => c.inflationAccum !== null)?.inflationAccum ?? null;
        const validDevaluation = [...cashflows].reverse().find(c => c.devaluationAccum !== null)?.devaluationAccum ?? null;

        return {
            endDate: end,
            monthsToExpiration: Math.max(0, monthsToExpiration),
            currentValue,
            nextAdjDate,
            monthsToNextAdj,
            validInflation,
            validDevaluation,
            growthPercentage
        };

    }, [selectedContract, cashflows]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Flujo Individual por Contrato</h2>

            {/* Contract Selector */}
            <Card className="bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">Seleccionar Contrato</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-slate-400">Cargando contratos...</div>
                    ) : contracts.length === 0 ? (
                        <div className="text-slate-400">
                            No hay contratos disponibles. Creá uno en la pestaña Contratos.
                        </div>
                    ) : (
                        <select
                            value={selectedContractId}
                            onChange={e => setSelectedContractId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded text-white"
                        >
                            <option value="">Seleccionar contrato...</option>
                            {contracts.map(contract => (
                                <option key={contract.id} value={contract.id}>
                                    {contract.property.name} - {contract.tenantName || 'Sin inquilino'}
                                    {' '}({new Date(contract.startDate).toLocaleDateString('es-AR')})
                                </option>
                            ))}
                        </select>
                    )}
                </CardContent>
            </Card>

            {/* Contract Stat Cards */}
            {selectedContract && contractMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Property & Term */}
                    <Card className="bg-slate-900 border-l-4 border-l-blue-500 border-y-0 border-r-0 rounded-l shadow-lg">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center h-full">
                            <div className="flex items-center gap-2 mb-1">
                                <Building2 className="text-blue-500 opacity-80" size={18} />
                                <p className="text-xs text-slate-400 uppercase font-semibold">Propiedad</p>
                            </div>
                            <h3 className="text-lg font-bold text-white leading-tight">{selectedContract.property.name}</h3>
                            <p className="text-sm text-slate-400 mt-1">{selectedContract.tenantName || 'Sin Inquilino'}</p>
                        </CardContent>
                    </Card>

                    {/* 2. Value */}
                    <Card className="bg-slate-900 border-l-4 border-l-emerald-500 border-y-0 border-r-0 rounded-l shadow-lg">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center h-full">
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="text-emerald-500 opacity-80" size={18} />
                                <p className="text-xs text-slate-400 uppercase font-semibold">Valor Actual</p>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400">
                                {showValues ? formatCurrency(contractMetrics.currentValue, selectedContract.currency) : '****'}
                            </h3>
                            <div className="flex items-center justify-between w-full mt-2 px-2">
                                <p className="text-xs text-slate-500">
                                    Base: {showValues ? formatCurrency(selectedContract.initialRent, selectedContract.currency) : '****'}
                                </p>
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${contractMetrics.growthPercentage > 0 ? 'text-emerald-500/80 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'}`}>
                                    {contractMetrics.growthPercentage > 0 ? '+' : ''}{formatPercent(contractMetrics.growthPercentage)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Expiration */}
                    <Card className="bg-slate-900 border-l-4 border-l-purple-500 border-y-0 border-r-0 rounded-l shadow-lg">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center h-full">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="text-purple-500 opacity-80" size={18} />
                                <p className="text-xs text-slate-400 uppercase font-semibold">Vencimiento</p>
                            </div>

                            <p className="text-base font-medium text-slate-200">
                                {contractMetrics.endDate.toLocaleDateString('es-AR')}
                            </p>

                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-bold text-purple-400">
                                    {contractMetrics.monthsToExpiration}
                                </span>
                                <span className="text-sm text-purple-400/80">meses</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 4. Next Adjustment */}
                    <Card className="bg-slate-900 border-l-4 border-l-amber-500 border-y-0 border-r-0 rounded-l shadow-lg">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center h-full">
                            <div className="flex items-center gap-2 mb-1">
                                <RefreshCw className="text-amber-500 opacity-80" size={18} />
                                <p className="text-xs text-slate-400 uppercase font-semibold">Próximo Ajuste</p>
                            </div>
                            {contractMetrics.nextAdjDate ? (
                                <>
                                    <p className="text-base font-medium text-slate-200">
                                        {contractMetrics.nextAdjDate.toLocaleDateString('es-AR')}
                                    </p>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <span className="text-2xl font-bold text-amber-500">
                                            {contractMetrics.monthsToNextAdj}
                                        </span>
                                        <span className="text-sm text-amber-500/80">meses</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-500 mt-2 font-medium">No aplica</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* 5. Indicators (Span 2 cols on large) */}
                    <Card className="bg-slate-900 border-slate-800 md:col-span-2 lg:col-span-4 grid grid-cols-2 divide-x divide-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="text-amber-500 opacity-60" size={18} />
                                <p className="text-xs text-slate-400 uppercase font-semibold">Inflación Acum.</p>
                            </div>
                            <p className="text-xl font-bold text-amber-400">
                                {formatPercent(contractMetrics.validInflation)}
                            </p>
                        </CardContent>
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="text-red-500 opacity-60" size={18} />
                                <p className="text-xs text-slate-400 uppercase font-semibold">Devaluación Acum.</p>
                            </div>
                            <p className="text-xl font-bold text-red-400">
                                {formatPercent(contractMetrics.validDevaluation)}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Cashflows Table */}
            {selectedContractId && (
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white">Cashflows Proyectados</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loadingCashflows ? (
                            <div className="text-slate-400 text-center py-12">Cargando cashflows...</div>
                        ) : cashflows.length === 0 ? (
                            <div className="text-slate-400 text-center py-12">
                                No hay cashflows generados para este contrato.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950">
                                        <tr className="border-b border-slate-800">
                                            <th className="text-left py-3 px-3 text-slate-300">Mes</th>
                                            <th className="text-left py-3 px-3 text-slate-300">Fecha</th>
                                            <th className="text-right py-3 px-3 text-slate-300">Monto ARS</th>
                                            <th className="text-right py-3 px-3 text-slate-300">Monto USD</th>
                                            <th className="text-right py-3 px-3 text-slate-300">IPC Mes</th>
                                            <th className="text-right py-3 px-3 text-slate-300">IPC Acum</th>
                                            <th className="text-right py-3 px-3 text-slate-300">TC</th>
                                            <th className="text-right py-3 px-3 text-slate-300">Inflación Total</th>
                                            <th className="text-right py-3 px-3 text-slate-300">Devaluación Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cashflows.map((cf, idx) => (
                                            <tr
                                                key={cf.id}
                                                className={`border-b border-slate-800 hover:bg-slate-900 ${cf.ipcAccumulated && cf.ipcAccumulated > 0 ? 'bg-blue-950/20' : ''
                                                    }`}
                                            >
                                                <td className="py-3 px-3 text-white font-medium">
                                                    #{cf.monthIndex}
                                                </td>
                                                <td className="py-3 px-3 text-slate-300">
                                                    {new Date(cf.date).toLocaleDateString('es-AR', {
                                                        year: 'numeric',
                                                        month: 'short'
                                                    })}
                                                </td>
                                                <td className="py-3 px-3 text-right text-white font-mono">
                                                    {showValues ? formatCurrency(cf.amountARS, 'ARS') : '****'}
                                                </td>
                                                <td className="py-3 px-3 text-right text-emerald-400 font-mono">
                                                    {showValues ? formatCurrency(cf.amountUSD, 'USD') : '****'}
                                                </td>
                                                <td className="py-3 px-3 text-right text-slate-400 font-mono">
                                                    {formatPercent(cf.ipcMonthly)}
                                                </td>
                                                <td className="py-3 px-3 text-right font-mono">
                                                    {cf.ipcAccumulated !== null ? (
                                                        <span className="text-blue-400">{formatPercent(cf.ipcAccumulated)}</span>
                                                    ) : (
                                                        <span className="text-slate-500">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 text-right text-slate-400 font-mono">
                                                    {cf.tc ? `$${cf.tc.toFixed(2)}` : '-'}
                                                </td>
                                                <td className="py-3 px-3 text-right text-amber-400 font-mono">
                                                    {formatPercent(cf.inflationAccum)}
                                                </td>
                                                <td className="py-3 px-3 text-right text-red-400 font-mono">
                                                    {formatPercent(cf.devaluationAccum)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-950 font-medium">
                                        <tr className="border-t-2 border-slate-700">
                                            <td colSpan={2} className="py-3 px-3 text-white">
                                                Total Proyectado
                                            </td>
                                            <td className="py-3 px-3 text-right text-white font-mono">
                                                {showValues ? formatCurrency(
                                                    cashflows.reduce((sum, cf) => sum + (cf.amountARS || 0), 0),
                                                    'ARS'
                                                ) : '****'}
                                            </td>
                                            <td className="py-3 px-3 text-right text-emerald-400 font-mono">
                                                {showValues ? formatCurrency(
                                                    cashflows.reduce((sum, cf) => sum + (cf.amountUSD || 0), 0),
                                                    'USD'
                                                ) : '****'}
                                            </td>
                                            <td colSpan={5}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
