'use client';

import { useMemo } from 'react';
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

        // 1. Current Month Finances
        let totalIncomeUSD = 0;
        let totalIncomeARS = 0;
        let totalExpenseUSD = 0;
        let totalExpenseARS = 0;

        consolidatedContracts.forEach(c => {
            const current = c.chartData.find(d => {
                const date = new Date(d.date);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });

            const amountUSD = current ? current.amountUSD : (c.chartData[c.chartData.length - 1]?.amountUSD || 0);
            const amountARS = current ? current.amountARS : (c.chartData[c.chartData.length - 1]?.amountARS || 0);

            if (c.propertyRole === 'TENANT') {
                totalExpenseUSD += amountUSD;
                if (c.currency === 'ARS') totalExpenseARS += amountARS;
            } else {
                totalIncomeUSD += amountUSD;
                if (c.currency === 'ARS') totalIncomeARS += amountARS;
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
            totalIncomeUSD,
            totalIncomeARS,
            totalExpenseUSD,
            totalExpenseARS,
            nextExpiration: nextExpirationGroup,
            nextAdjustment: nextAdjustmentGroup,
            count: consolidatedContracts.length
        };

    }, [consolidatedContracts]);


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
                                {entry.name.includes('USD') || entry.name.includes('Ingreso') || entry.name.includes('Gasto')
                                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(entry.value)
                                    : `${entry.value.toFixed(2)}%`
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

    const hasExpenses = (summaryMetrics?.totalExpenseUSD || 0) > 0 || (globalData?.history?.some((h: any) => (h.expenseUSD || 0) > 0));

    return (
        <div className="space-y-8 print:space-y-4">
            <h2 className="text-2xl font-bold text-white print:text-slate-900 print:hidden">Dashboard General</h2>

            {/* Top Summary Cards */}
            {summaryMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Income Card */}
                    <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white print:text-slate-900">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-emerald-500">
                                <DollarSign size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Ingresos Mes Actual</span>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400 print:text-emerald-700">
                                {showValues
                                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(summaryMetrics.totalIncomeUSD)
                                    : '****'}
                            </h3>
                            {summaryMetrics.totalIncomeARS > 0 && (
                                <p className="text-xs text-slate-500 mt-1">
                                    + {showValues
                                        ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(summaryMetrics.totalIncomeARS)
                                        : '****'} (ARS)
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Expenses Card - Only if Tenant */}
                    {summaryMetrics.totalExpenseUSD > 0 && (
                        <Card className="bg-slate-950 border-slate-800 print:border-slate-300 print:bg-white print:text-slate-900">
                            <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                                <div className="flex items-center gap-2 mb-2 text-rose-500">
                                    <DollarSign size={20} />
                                    <span className="text-sm font-semibold uppercase text-slate-400 print:text-slate-600 tracking-wider">Gastos Mes Actual</span>
                                </div>
                                <h3 className="text-2xl font-bold text-rose-400 print:text-rose-700">
                                    {showValues
                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(summaryMetrics.totalExpenseUSD)
                                        : '****'}
                                </h3>
                                {summaryMetrics.totalExpenseARS > 0 && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        + {showValues
                                            ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(summaryMetrics.totalExpenseARS)
                                            : '****'} (ARS)
                                    </p>
                                )}
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
                                                {summaryMetrics.nextExpiration.properties[0].propertyName}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-purple-400 print:text-purple-700 font-medium">
                                                    {summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextExpiration.monthsRemaining} meses
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-2xl font-bold text-white print:text-slate-900">
                                                {summaryMetrics.nextExpiration.count} Propiedades
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-purple-400 print:text-purple-700 font-medium">
                                                    {summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextExpiration.monthsRemaining} meses
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400 max-w-full">
                                                {summaryMetrics.nextExpiration.properties.map((p, idx) => (
                                                    <div key={idx} className="truncate">{p.propertyName}</div>
                                                ))}
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
                                                {summaryMetrics.nextAdjustment.properties[0].propertyName}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-amber-500 print:text-amber-700 font-medium">
                                                    {summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextAdjustment.monthsRemaining} meses
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-2xl font-bold text-white print:text-slate-900">
                                                {summaryMetrics.nextAdjustment.count} Propiedades
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-amber-500 print:text-amber-700 font-medium">
                                                    {summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextAdjustment.monthsRemaining} meses
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400 max-w-full">
                                                {summaryMetrics.nextAdjustment.properties.map((p, idx) => (
                                                    <div key={idx} className="truncate">{p.propertyName}</div>
                                                ))}
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
                            <h3 className="text-3xl font-bold text-white print:text-slate-900">
                                {summaryMetrics.count}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">propiedades alquiladas</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Global Charts Section */}
            {globalData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 mt-8">
                    {/* Global History Chart - INCOME */}
                    <Card className="bg-slate-950 border-slate-800 lg:col-span-2 shadow-lg print:border-slate-300 print:bg-white">
                        <CardHeader>
                            <CardTitle className="text-white print:text-slate-900">Evolución Ingresos Totales (USD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={showValues ? globalData.history : []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                        <XAxis
                                            dataKey="monthLabel"
                                            stroke="#64748b"
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            tickMargin={10}
                                        />
                                        <YAxis
                                            stroke="#10b981"
                                            tick={{ fill: '#10b981', fontSize: 12 }}
                                            tickFormatter={(value) => `$${value}`}
                                            width={60}
                                        />
                                        {showValues && (
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                formatter={(value: number) => [`$${Math.round(value)}`, 'Total USD']}
                                                labelStyle={{ color: '#94a3b8' }}
                                            />
                                        )}
                                        <Bar dataKey="incomeUSD" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingreso Total" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Global History Chart - EXPENSES (If applicable) */}
                    {hasExpenses && (
                        <Card className="bg-slate-950 border-slate-800 lg:col-span-2 shadow-lg print:border-slate-300 print:bg-white">
                            <CardHeader>
                                <CardTitle className="text-white print:text-slate-900 text-rose-400">Evolución Gastos Totales (USD)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={showValues ? globalData.history : []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                                            <XAxis
                                                dataKey="monthLabel"
                                                stroke="#64748b"
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                tickMargin={10}
                                            />
                                            <YAxis
                                                stroke="#f43f5e"
                                                tick={{ fill: '#f43f5e', fontSize: 12 }}
                                                tickFormatter={(value) => `$${value}`}
                                                width={60}
                                            />
                                            {showValues && (
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                    itemStyle={{ color: '#f8fafc' }}
                                                    formatter={(value: number) => [`$${Math.round(value)}`, 'Total USD']}
                                                    labelStyle={{ color: '#94a3b8' }}
                                                />
                                            )}
                                            <Bar dataKey="expenseUSD" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Gasto Total" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Currency Pie Chart */}
                    <Card className="bg-slate-950 border-slate-800 shadow-lg print:border-slate-300 print:bg-white">
                        <CardHeader>
                            <CardTitle className="text-white print:text-slate-900 flex items-center gap-2">
                                <PieChartIcon size={16} /> Distribución Moneda
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center p-6">
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={
                                                showValues && globalData.currencyDistribution
                                                    ? [
                                                        { name: 'USD', value: globalData.currencyDistribution.USD },
                                                        { name: 'ARS', value: globalData.currencyDistribution.ARS }
                                                    ].filter((d: any) => d.value > 0)
                                                    : [{ name: 'Oculto', value: 1 }]
                                            }
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={showValues ? 5 : 0}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {showValues ? (
                                                globalData.currencyDistribution && [
                                                    { name: 'USD', value: globalData.currencyDistribution.USD },
                                                    { name: 'ARS', value: globalData.currencyDistribution.ARS }
                                                ].filter((d: any) => d.value > 0).map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6'][index % 2]} />
                                                ))
                                            ) : (
                                                <Cell fill="#1e293b" />
                                            )}
                                        </Pie>
                                        {showValues && (
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                formatter={(value: number, name: string) => [`${value} Contratos`, name]}
                                            />
                                        )}
                                        {showValues && <Legend verticalAlign="bottom" height={36} />}
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Individual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                {activeContracts.map((contract) => {
                    const lastInf = [...contract.chartData].reverse().find(d => d.inflationAccum !== 0)?.inflationAccum ?? 0;
                    const lastDev = [...contract.chartData].reverse().find(d => d.devaluationAccum !== 0)?.devaluationAccum ?? 0;

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
                                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(lastRent)
                                                        : '****'}
                                                </span>
                                                {Math.round(lastRent) > Math.round(avgRent) && <Triangle size={10} className="fill-emerald-500 text-emerald-500" />}
                                                {Math.round(lastRent) < Math.round(avgRent) && <Triangle size={10} className="fill-rose-500 text-rose-500 rotate-180" />}
                                                {Math.round(lastRent) === Math.round(avgRent) && <Minus size={10} className="text-slate-500" />}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Promedio</span>
                                                <span className="text-xl font-mono font-bold text-white print:text-slate-900">
                                                    {showValues
                                                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(avgRent)
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
                                                tickFormatter={(value) => `$${value}`}
                                                width={60}
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
                                                dataKey="amountUSD"
                                                name="Alquiler USD"
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
