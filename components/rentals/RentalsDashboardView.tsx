'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { DollarSign, Calendar, Clock, Building2, TrendingUp, AlertCircle, Triangle, Minus, PieChart as PieChartIcon } from 'lucide-react';
import InterannualChart from '@/components/economic/InterannualChart';

export interface ChartPoint {
    date: string;
    monthLabel: string;
    amountUSD: number;
    amountARS: number;
    inflationAccum: number;
    devaluationAccum: number;
}

export interface ContractDashboardData {
    contractId: string;
    propertyName: string;
    tenantName: string | null;
    currency: string;
    initialRent: number;
    startDate: string;
    durationMonths: number;
    adjustmentType: string;
    adjustmentFrequency: number | null;
    isConsolidated: boolean;
    propertyRole: 'OWNER' | 'TENANT';
    chartData: ChartPoint[];
}

export interface RentalsDashboardViewProps {
    contractsData: ContractDashboardData[];
    globalData: any;
    showValues: boolean;
    loading?: boolean;
}

export function RentalsDashboardView({ contractsData, globalData, showValues, loading = false }: RentalsDashboardViewProps) {
    const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
    // const [chartFilter, setChartFilter] = useState<'ALL' | 'OWNER' | 'TENANT'>('ALL'); // Removed: Moved to ConsolidatedCashflowTab
    const activeContracts = useMemo(() => {
        const now = new Date();
        return contractsData.filter(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            return now >= start && now <= end;
        });
    }, [contractsData]);

    const consolidatedContracts = useMemo(() => {
        return activeContracts.filter(c => c.isConsolidated);
    }, [activeContracts]);

    const summaryMetrics = useMemo(() => {
        if (consolidatedContracts.length === 0) return null;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Current Month Finances
        let totalIncome = 0;
        let totalExpense = 0;

        consolidatedContracts.forEach(c => {
            const currentMonthData = c.chartData.find(d => {
                // Robust date matching: Compare YYYY-MM strings based on Data Date (which should be start of month)
                // Data is UTC YYYY-MM-01. We want to match it with "Current Month".
                // If we use toISOString() on 'now', it converts to UTC based on system time if it was created locally? No, toISOString is always UTC.
                // But the 'now' object is local.
                const dDate = new Date(d.date); // d.date is string from JSON, likely YYYY-MM-DDTHH:mm:ss.sssZ

                // We want to match against the Viewing User's Current Month (System Time)
                // If User is in Jan, we want Jan data.
                return dDate.getUTCFullYear() === currentYear && dDate.getUTCMonth() === currentMonth;
            });

            // Use current month data if available, otherwise fallback to the last available data point
            const amountUSD = currentMonthData ? currentMonthData.amountUSD : (c.chartData[c.chartData.length - 1]?.amountUSD || 0);
            const amountARS = currentMonthData ? currentMonthData.amountARS : (c.chartData[c.chartData.length - 1]?.amountARS || 0);

            // Select amount based on current currency
            const amount = currency === 'ARS' ? amountARS : amountUSD;

            if (c.propertyRole === 'TENANT') {
                totalExpense += amount;
            } else {
                totalIncome += amount;
            }
        });

        // 2. Next Expiration - Group all properties expiring in the same month
        const expirations = consolidatedContracts.map(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            return { ...c, endDate: end };
        }).filter(c => c.endDate >= now).sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

        let nextExpirationGroup = null;
        if (expirations.length > 0) {
            const firstEndDate = expirations[0].endDate;
            const sameMonthExpirations = expirations.filter(c => {
                return c.endDate.getMonth() === firstEndDate.getMonth() &&
                    c.endDate.getFullYear() === firstEndDate.getFullYear();
            });

            const monthsDiff = (firstEndDate.getFullYear() - now.getFullYear()) * 12 + (firstEndDate.getMonth() - now.getMonth());
            nextExpirationGroup = {
                properties: sameMonthExpirations,
                endDate: firstEndDate,
                monthsRemaining: Math.max(0, monthsDiff),
                count: sameMonthExpirations.length
            };
        }

        // 3. Next Adjustment - Group all properties adjusting in the same month
        const upcomingAdjustments = consolidatedContracts.map(c => {
            if (c.adjustmentType !== 'IPC') return null;

            const start = new Date(c.startDate);
            const freq = c.adjustmentFrequency || 12;
            let check = new Date(start);

            while (check <= now) {
                check.setMonth(check.getMonth() + freq);
            }

            return {
                ...c,
                nextAdjDate: check
            };
        }).filter(c => c !== null).sort((a, b) => a!.nextAdjDate.getTime() - b!.nextAdjDate.getTime());

        let nextAdjustmentGroup = null;
        if (upcomingAdjustments.length > 0) {
            const firstAdjDate = upcomingAdjustments[0].nextAdjDate;
            const sameMonthAdjustments = upcomingAdjustments.filter(c => {
                return c.nextAdjDate.getMonth() === firstAdjDate.getMonth() &&
                    c.nextAdjDate.getFullYear() === firstAdjDate.getFullYear();
            });

            const monthsDiff = (firstAdjDate.getFullYear() - now.getFullYear()) * 12 + (firstAdjDate.getMonth() - now.getMonth());
            nextAdjustmentGroup = {
                properties: sameMonthAdjustments,
                nextAdjDate: firstAdjDate,
                monthsRemaining: Math.max(0, monthsDiff),
                count: sameMonthAdjustments.length
            };
        }

        return {
            totalIncome,
            totalExpense,
            nextExpiration: nextExpirationGroup,
            nextAdjustment: nextAdjustmentGroup,
            count: consolidatedContracts.length
        };

    }, [consolidatedContracts, currency]);


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length && showValues) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-sm">
                    <p className="font-bold text-white mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-300">
                                {entry.name}: {' '}
                            </span>
                            <span className="font-mono font-medium text-white">
                                {entry.name.includes('Inf.') || entry.name.includes('Dev.')
                                    ? `${entry.value.toFixed(2)}%`
                                    : new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
                                        style: 'currency',
                                        currency,
                                        maximumFractionDigits: 0,
                                        minimumFractionDigits: 0
                                    }).format(entry.value)
                                }
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return <div className="text-slate-400 text-center py-12">Cargando dashboard...</div>;
    }

    if (contractsData.length === 0) {
        return (
            <div className="text-slate-400 text-center py-12">
                No hay contratos vigentes para mostrar.
            </div>
        );
    }

    // const hasExpenses = (summaryMetrics?.totalExpenseUSD || 0) > 0 || (globalData?.history?.some((h: any) => (h.expenseUSD || 0) > 0)); // Removed: Not used here anymore

    return (
        <div className="space-y-8 print:space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                    Dashboard General
                </h2>

                {/* Currency Toggle */}
                <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setCurrency('USD')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currency === 'USD'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        USD
                    </button>
                    <button
                        onClick={() => setCurrency('ARS')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currency === 'ARS'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        ARS
                    </button>
                </div>
            </div>

            {/* Top Summary Cards */}
            {summaryMetrics && (
                <div className={`grid grid-cols-1 md:grid-cols-2 ${summaryMetrics.totalExpense > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
                    {/* Income Card */}
                    <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white print:text-slate-900">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-emerald-500">
                                <DollarSign size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Ingresos Mes Actual</span>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400 print:text-emerald-700">
                                {showValues
                                    ? new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(summaryMetrics.totalIncome)
                                    : '****'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {showValues ? `${consolidatedContracts.filter(c => c.propertyRole === 'OWNER').length} propiedades activas` : '****'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Expenses Card - Only if Tenant */}
                    {summaryMetrics.totalExpense > 0 && (
                        <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white print:text-slate-900">
                            <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                                <div className="flex items-center gap-2 mb-2 text-rose-500">
                                    <DollarSign size={20} />
                                    <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Gastos Mes Actual</span>
                                </div>
                                <h3 className="text-2xl font-bold text-rose-400 print:text-rose-700">
                                    {showValues
                                        ? new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(summaryMetrics.totalExpense)
                                        : '****'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {showValues ? `${consolidatedContracts.filter(c => c.propertyRole === 'TENANT').length} propiedades alquiladas` : '****'}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Next Expiration */}
                    <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-purple-500">
                                <Calendar size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Próximo Vencimiento</span>
                            </div>
                            {summaryMetrics.nextExpiration ? (
                                <>
                                    {summaryMetrics.nextExpiration.count === 1 ? (
                                        <>
                                            <h3 className="text-2xl font-bold text-white print:text-slate-900">
                                                {showValues ? summaryMetrics.nextExpiration.properties[0].propertyName : '****'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-purple-400 print:text-purple-700 font-medium">
                                                    {showValues ? summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR') : '****'}
                                                </p>
                                                <span className="text-sm font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded uppercase">
                                                    {showValues ? `${summaryMetrics.nextExpiration.monthsRemaining} meses` : '****'}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-2xl font-bold text-white print:text-slate-900">
                                                {showValues ? `${summaryMetrics.nextExpiration.count} Propiedades` : '****'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-purple-400 print:text-purple-700 font-medium">
                                                    {showValues ? summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR') : '****'}
                                                </p>
                                                <span className="text-sm font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded uppercase">
                                                    {showValues ? `${summaryMetrics.nextExpiration.monthsRemaining} meses` : '****'}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400 max-w-full text-center px-2">
                                                {showValues ? (
                                                    summaryMetrics.nextExpiration.properties.map(p => p.propertyName).join(', ')
                                                ) : (
                                                    <div>****</div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-500">Sin vencimientos próximos</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Next Adjustment */}
                    <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-amber-500">
                                <Clock size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Próxima Actualización</span>
                            </div>
                            {summaryMetrics.nextAdjustment ? (
                                <>
                                    {summaryMetrics.nextAdjustment.count === 1 ? (
                                        <>
                                            <h3 className="text-2xl font-bold text-white print:text-slate-900">
                                                {showValues ? summaryMetrics.nextAdjustment.properties[0].propertyName : '****'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-amber-400 print:text-amber-700 font-medium">
                                                    {showValues ? summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR') : '****'}
                                                </p>
                                                <span className="text-sm font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded uppercase">
                                                    {showValues ? `${summaryMetrics.nextAdjustment.monthsRemaining} meses` : '****'}
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-2xl font-bold text-white print:text-slate-900">
                                                {showValues ? summaryMetrics.nextAdjustment.count + ' Propiedades' : '****'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-amber-400 print:text-amber-700 font-medium">
                                                    {showValues ? summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR') : '****'}
                                                </p>
                                                <span className="text-sm font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextAdjustment.monthsRemaining} meses
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400 max-w-full text-center px-2">
                                                {showValues ? (
                                                    summaryMetrics.nextAdjustment.properties.map(p => p.propertyName).join(', ')
                                                ) : (
                                                    <div>****</div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-500">Sin actualizaciones próximas</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Active Contracts */}
                    <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-blue-500">
                                <Building2 size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Contratos Activos</span>
                            </div>
                            <h3 className="text-2xl font-bold text-blue-400 print:text-blue-700">
                                {showValues ? summaryMetrics.count : '****'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {showValues ? 'propiedades alquiladas' : '****'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}


            {/* Global Charts Section (Restored - Owner Only) */}
            {globalData && (
                <div className="space-y-12">
                    {/* Income Charts (Owner) */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp size={24} className="text-emerald-500" />
                            Historico Global (Ingresos)
                        </h2>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Income Bar Chart - Adaptive Width */}
                            <Card className={`bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white ${(globalData?.currencyDistribution?.owner?.USD > 0 || globalData?.currencyDistribution?.owner?.ARS > 0) ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                                <CardHeader>
                                    <CardTitle className="text-white print:text-slate-900">Evolución Ingresos Totales ({currency})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={showValues ? globalData.history : []} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                                                <YAxis
                                                    stroke="#10b981"
                                                    tick={{ fill: '#10b981', fontSize: 12 }}
                                                    tickFormatter={(value) => new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)}
                                                    width={80}
                                                />
                                                {showValues && (
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                        formatter={(value: number) => [
                                                            new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value),
                                                            `Total ${currency}`
                                                        ]}
                                                        labelStyle={{ color: '#94a3b8' }}
                                                    />
                                                )}
                                                <Bar
                                                    dataKey={currency === 'ARS' ? 'incomeARS' : 'incomeUSD'}
                                                    fill="#10b981"
                                                    radius={[4, 4, 0, 0]}
                                                    name={`Ingreso ${currency}`}
                                                    label={{
                                                        position: 'top',
                                                        fill: '#10b981',
                                                        fontSize: 11,
                                                        formatter: (value: number) => value > 0 ? new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : ''
                                                    }}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Income Pie Chart - Restored & Conditional */}
                            {(globalData?.currencyDistribution?.owner?.USD > 0 || globalData?.currencyDistribution?.owner?.ARS > 0) && (
                                <Card className="bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="text-white print:text-slate-900 flex items-center gap-2">
                                            <PieChartIcon size={16} /> Distribución (Ingresos)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col items-center justify-center p-4 flex-1">
                                        <div className="h-[200px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={showValues ? [{ name: 'USD', value: globalData.currencyDistribution.owner.USD }, { name: 'ARS', value: globalData.currencyDistribution.owner.ARS }].filter((d: any) => d.value > 0) : [{ name: 'Sin datos', value: 1 }]}
                                                        cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={showValues ? 5 : 0} dataKey="value" stroke="none"
                                                    >
                                                        {showValues ? (
                                                            [{ name: 'USD', value: globalData.currencyDistribution.owner.USD }, { name: 'ARS', value: globalData.currencyDistribution.owner.ARS }].filter((d: any) => d.value > 0).map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={entry.name === 'USD' ? '#10b981' : '#3b82f6'} />
                                                            ))
                                                        ) : (<Cell fill="#1e293b" />)}
                                                    </Pie>
                                                    {showValues && <Tooltip />}
                                                    {showValues && <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />}
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                        </div>
                    </div>

                    {/* Expense Charts (Tenant) - Conditional */}
                    {globalData.history.some((h: any) => (h.expenseUSD || 0) > 0) && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <TrendingUp size={24} className="text-rose-500" />
                                Historico Global (Gastos)
                            </h2>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Expense Bar Chart - Adaptive Width */}
                                <Card className={`bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white ${(globalData?.currencyDistribution?.tenant?.USD > 0 || globalData?.currencyDistribution?.tenant?.ARS > 0) ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                                    <CardHeader>
                                        <CardTitle className="text-white print:text-slate-900">Evolución Gastos Totales ({currency})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={showValues ? globalData.history : []} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                                    <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                                                    <YAxis
                                                        stroke="#f43f5e"
                                                        tick={{ fill: '#f43f5e', fontSize: 12 }}
                                                        tickFormatter={(value) => new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)}
                                                        width={80}
                                                    />
                                                    {showValues && (
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                            formatter={(value: number) => [
                                                                new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value),
                                                                `Total ${currency}`
                                                            ]}
                                                            labelStyle={{ color: '#94a3b8' }}
                                                        />
                                                    )}
                                                    <Bar
                                                        dataKey={currency === 'ARS' ? 'expenseARS' : 'expenseUSD'}
                                                        fill="#f43f5e"
                                                        radius={[4, 4, 0, 0]}
                                                        name={`Gasto ${currency}`}
                                                        label={{
                                                            position: 'top',
                                                            fill: '#f43f5e',
                                                            fontSize: 11,
                                                            formatter: (value: number) => value > 0 ? new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : ''
                                                        }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Expense Pie Chart - Conditional */}
                                {(globalData?.currencyDistribution?.tenant?.USD > 0 || globalData?.currencyDistribution?.tenant?.ARS > 0) && (
                                    <Card className="bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white flex flex-col">
                                        <CardHeader>
                                            <CardTitle className="text-white print:text-slate-900 flex items-center gap-2">
                                                <PieChartIcon size={16} /> Distribución (Gastos)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex flex-col items-center justify-center p-4 flex-1">
                                            <div className="h-[200px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={showValues && globalData?.currencyDistribution?.tenant ? [{ name: 'USD', value: globalData.currencyDistribution.tenant.USD }, { name: 'ARS', value: globalData.currencyDistribution.tenant.ARS }].filter((d: any) => d.value > 0) : [{ name: 'Sin datos', value: 1 }]}
                                                            cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={showValues ? 5 : 0} dataKey="value" stroke="none"
                                                        >
                                                            {showValues && globalData?.currencyDistribution?.tenant ? (
                                                                [{ name: 'USD', value: globalData.currencyDistribution.tenant.USD }, { name: 'ARS', value: globalData.currencyDistribution.tenant.ARS }].filter((d: any) => d.value > 0).map((entry: any, index: number) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.name === 'USD' ? '#f43f5e' : '#3b82f6'} />
                                                                ))
                                                            ) : (<Cell fill="#1e293b" />)}
                                                        </Pie>
                                                        {showValues && <Tooltip />}
                                                        {showValues && <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />}
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}



            {/* Individual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                {activeContracts.map((contract) => {
                    // Use last VALID (non-null) data point, not just non-zero
                    // If current month doesn't have inflation data yet, use last month's
                    const lastInf = [...contract.chartData].reverse().find(d => d.inflationAccum !== null && d.inflationAccum !== undefined)?.inflationAccum ?? 0;
                    const lastDev = [...contract.chartData].reverse().find(d => d.devaluationAccum !== null && d.devaluationAccum !== undefined)?.devaluationAccum ?? 0;

                    const lastRent = contract.chartData[contract.chartData.length - 1]?.amountUSD || 0;
                    const avgRent = contract.chartData.reduce((sum, d) => sum + d.amountUSD, 0) / (contract.chartData.length || 1);

                    return (
                        <Card key={contract.contractId} className="bg-slate-950 border-slate-800 shadow-lg break-inside-avoid print:border-slate-300 print:bg-white">
                            <CardHeader className="border-b border-slate-800/50 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-white print:text-slate-900 flex items-center gap-3">
                                            {contract.propertyName}
                                            <span className={`text-xs px-2 py-0.5 rounded border ${contract.currency === 'USD' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-blue-950 text-blue-400 border-blue-800'}`}>
                                                {contract.currency}
                                            </span>
                                            {!contract.isConsolidated && (
                                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                                                    No Consolida
                                                </span>
                                            )}
                                        </CardTitle>
                                        <p className="text-sm text-slate-400 mt-1">{contract.tenantName || 'Inquilino'}</p>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="flex flex-col items-end gap-1 text-right">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Último</span>
                                                <span className="text-xl font-mono font-bold text-white print:text-slate-900">
                                                    {showValues
                                                        ? new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
                                                            style: 'currency',
                                                            currency,
                                                            maximumFractionDigits: 0
                                                        }).format(
                                                            currency === 'ARS'
                                                                ? (contract.chartData[contract.chartData.length - 1]?.amountARS || 0)
                                                                : (contract.chartData[contract.chartData.length - 1]?.amountUSD || 0)
                                                        )
                                                        : '****'}
                                                </span>
                                                {/* Trends simplified: compare last vs avg in same currency */}
                                                {/* For simplicity, keeping trend indicators based on USD to avoid double calc or weird ARS inflation trends confusing the "avg" logic visually */}
                                                {Math.round(lastRent) > Math.round(avgRent) && <Triangle size={10} className="fill-emerald-500 text-emerald-500" />}
                                                {Math.round(lastRent) < Math.round(avgRent) && <Triangle size={10} className="fill-rose-500 text-rose-500 rotate-180" />}
                                                {Math.round(lastRent) === Math.round(avgRent) && <Minus size={10} className="text-slate-500" />}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Promedio</span>
                                                <span className="text-xl font-mono font-bold text-white print:text-slate-900">
                                                    {showValues
                                                        ? new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', {
                                                            style: 'currency',
                                                            currency,
                                                            maximumFractionDigits: 0
                                                        }).format(
                                                            currency === 'ARS'
                                                                ? (contract.chartData.reduce((sum, d) => sum + d.amountARS, 0) / (contract.chartData.length || 1))
                                                                : avgRent
                                                        )
                                                        : '****'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 border-l border-slate-800 pl-6">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp size={14} className="text-amber-500" />
                                                <span className="text-xs text-slate-400">Infl. Acum:</span>
                                                <span className="text-sm text-white print:text-slate-900 font-mono font-bold">{lastInf.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size={14} className="text-rose-500" />
                                                <span className="text-xs text-slate-400">Dev. Acum:</span>
                                                <span className="text-sm text-white print:text-slate-900 font-mono font-bold">{lastDev.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 print:pt-2">
                                <div className="h-[300px] print:h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart
                                            data={showValues ? contract.chartData : []}
                                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                            <XAxis
                                                dataKey="monthLabel"
                                                stroke="#64748b"
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                tickMargin={10}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#10b981"
                                                tick={{ fill: '#10b981', fontSize: 12 }}
                                                tickFormatter={(value) => new Intl.NumberFormat(currency === 'ARS' ? 'es-AR' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)}
                                                width={80}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#f59e0b"
                                                tick={{ fill: '#f59e0b', fontSize: 12 }}
                                                tickFormatter={(value) => `${Math.round(value)}%`}
                                                width={40}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            {showValues && <Legend wrapperStyle={{ paddingTop: '10px' }} />}

                                            <Bar
                                                yAxisId="left"
                                                dataKey={currency === 'ARS' ? 'amountARS' : 'amountUSD'}
                                                name={`Alquiler ${currency}`}
                                                fill="#10b981"
                                                radius={[4, 4, 0, 0]}
                                                maxBarSize={50}
                                                fillOpacity={0.8}
                                            />

                                            <Line
                                                yAxisId="right"
                                                type="linear"
                                                dataKey="inflationAccum"
                                                name="Inf. Acum."
                                                stroke="#f59e0b"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="linear"
                                                dataKey="devaluationAccum"
                                                name="Dev. Acum."
                                                stroke="#f43f5e"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Economic Context */}
            <InterannualChart />
        </div>
    );
}
