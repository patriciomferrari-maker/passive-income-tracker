'use client';

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
    BarChart
} from 'recharts';
import { DollarSign, Calendar, Clock, Building2, TrendingUp, AlertCircle, Triangle, Minus } from 'lucide-react';
import { useMemo } from 'react';

interface ChartPoint {
    date: string;
    monthLabel: string;
    amountUSD: number;
    amountARS: number;
    inflationAccum: number | null;
    devaluationAccum: number | null;
}

interface ContractDashboardData {
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

interface Props {
    contractsData: ContractDashboardData[];
    globalData: any;
}

export default function RentalsDashboardPrint({ contractsData, globalData }: Props) {
    const currency = 'USD'; // Fixed to USD for print
    const showValues = true; // Always show values in print

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

        let totalIncome = 0;
        let totalExpense = 0;

        consolidatedContracts.forEach(c => {
            const currentMonthData = c.chartData.find(d => {
                const dDate = new Date(d.date);
                return dDate.getUTCFullYear() === currentYear && dDate.getUTCMonth() === currentMonth;
            });

            const amountUSD = currentMonthData ? currentMonthData.amountUSD : (c.chartData[c.chartData.length - 1]?.amountUSD || 0);

            if (c.propertyRole === 'TENANT') {
                totalExpense += amountUSD;
            } else {
                totalIncome += amountUSD;
            }
        });

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

    }, [consolidatedContracts]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-slate-300 p-3 rounded shadow-xl text-sm">
                    <p className="font-bold text-slate-900 mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-700">
                                {entry.name}: {' '}
                            </span>
                            <span className="font-mono font-medium text-slate-900">
                                {entry.name.includes('Inf.') || entry.name.includes('Dev.')
                                    ? `${entry.value.toFixed(2)}%`
                                    : new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
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

    if (contractsData.length === 0) {
        return (
            <div className="text-slate-600 text-center py-12">
                No hay contratos vigentes para mostrar.
            </div>
        );
    }

    return (
        <div className="space-y-8 bg-white text-slate-900">
            {/* Top Summary Cards */}
            {summaryMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Income Card */}
                    <Card className="bg-white border-slate-300">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-emerald-600">
                                <DollarSign size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-600 tracking-wider">Ingresos Mes Actual</span>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-700">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(summaryMetrics.totalIncome)}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {consolidatedContracts.filter(c => c.propertyRole === 'OWNER').length} propiedades activas
                            </p>
                        </CardContent>
                    </Card>

                    {/* Next Expiration */}
                    <Card className="bg-white border-slate-300">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-purple-600">
                                <Calendar size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-600 tracking-wider">Próximo Vencimiento</span>
                            </div>
                            {summaryMetrics.nextExpiration ? (
                                <>
                                    {summaryMetrics.nextExpiration.count === 1 ? (
                                        <>
                                            <h3 className="text-2xl font-bold text-slate-900">
                                                {summaryMetrics.nextExpiration.properties[0].propertyName}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-purple-700 font-medium">
                                                    {summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextExpiration.monthsRemaining} meses
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-2xl font-bold text-slate-900">
                                                {summaryMetrics.nextExpiration.count} Propiedades
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-purple-700 font-medium">
                                                    {summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextExpiration.monthsRemaining} meses
                                                </span>
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
                    <Card className="bg-white border-slate-300">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-amber-600">
                                <Clock size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-600 tracking-wider">Próxima Actualización</span>
                            </div>
                            {summaryMetrics.nextAdjustment ? (
                                <>
                                    {summaryMetrics.nextAdjustment.count === 1 ? (
                                        <>
                                            <h3 className="text-2xl font-bold text-slate-900">
                                                {summaryMetrics.nextAdjustment.properties[0].propertyName}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-amber-700 font-medium">
                                                    {summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextAdjustment.monthsRemaining} meses
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h3 className="text-2xl font-bold text-slate-900">
                                                {summaryMetrics.nextAdjustment.count} Propiedades
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-lg text-amber-700 font-medium">
                                                    {summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR')}
                                                </p>
                                                <span className="text-sm font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase">
                                                    {summaryMetrics.nextAdjustment.monthsRemaining} meses
                                                </span>
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
                    <Card className="bg-white border-slate-300">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-blue-600">
                                <Building2 size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-600 tracking-wider">Contratos Activos</span>
                            </div>
                            <h3 className="text-2xl font-bold text-blue-700">
                                {summaryMetrics.count}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                propiedades alquiladas
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Global Chart Section */}
            {globalData && globalData.history && globalData.history.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp size={24} className="text-emerald-600" />
                        Histórico Global (Ingresos)
                    </h2>

                    <Card className="bg-white border-slate-300 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-slate-900">Evolución Ingresos Totales (USD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={globalData.history} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} isAnimationActive={false}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} vertical={false} />
                                        <XAxis dataKey="monthLabel" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} />
                                        <YAxis
                                            stroke="#10b981"
                                            tick={{ fill: '#10b981', fontSize: 12 }}
                                            tickFormatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}
                                            width={80}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar
                                            dataKey="incomeUSD"
                                            fill="#10b981"
                                            radius={[4, 4, 0, 0]}
                                            name="Ingreso USD"
                                            isAnimationActive={false}
                                            label={{
                                                position: 'top',
                                                fill: '#10b981',
                                                fontSize: 11,
                                                formatter: (value: number) => value > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) : ''
                                            }}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Individual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeContracts.map((contract) => {
                    const lastInf = [...contract.chartData].reverse().find(d => d.inflationAccum !== null && d.inflationAccum !== undefined)?.inflationAccum ?? 0;
                    const lastDev = [...contract.chartData].reverse().find(d => d.devaluationAccum !== null && d.devaluationAccum !== undefined)?.devaluationAccum ?? 0;

                    const lastRent = contract.chartData[contract.chartData.length - 1]?.amountUSD || 0;
                    const avgRent = contract.chartData.reduce((sum, d) => sum + d.amountUSD, 0) / (contract.chartData.length || 1);

                    return (
                        <Card key={contract.contractId} className="bg-white border-slate-300 shadow-lg break-inside-avoid">
                            <CardHeader className="border-b border-slate-200 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-slate-900 flex items-center gap-3">
                                            {contract.propertyName}
                                            <span className={`text-xs px-2 py-0.5 rounded border ${contract.currency === 'USD' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                                                {contract.currency}
                                            </span>
                                        </CardTitle>
                                        <p className="text-sm text-slate-600 mt-1">{contract.tenantName || 'Inquilino'}</p>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="flex flex-col items-end gap-1 text-right">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Último</span>
                                                <span className="text-xl font-mono font-bold text-slate-900">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: 'USD',
                                                        maximumFractionDigits: 0
                                                    }).format(contract.chartData[contract.chartData.length - 1]?.amountUSD || 0)}
                                                </span>
                                                {Math.round(lastRent) > Math.round(avgRent) && <Triangle size={10} className="fill-emerald-600 text-emerald-600" />}
                                                {Math.round(lastRent) < Math.round(avgRent) && <Triangle size={10} className="fill-rose-600 text-rose-600 rotate-180" />}
                                                {Math.round(lastRent) === Math.round(avgRent) && <Minus size={10} className="text-slate-500" />}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Promedio</span>
                                                <span className="text-xl font-mono font-bold text-slate-900">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: 'USD',
                                                        maximumFractionDigits: 0
                                                    }).format(avgRent)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 border-l border-slate-300 pl-6">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp size={14} className="text-amber-600" />
                                                <span className="text-xs text-slate-600">Infl. Acum:</span>
                                                <span className="text-sm text-slate-900 font-mono font-bold">{lastInf.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size={14} className="text-rose-600" />
                                                <span className="text-xs text-slate-600">Dev. Acum:</span>
                                                <span className="text-sm text-slate-900 font-mono font-bold">{lastDev.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart
                                            data={contract.chartData}
                                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} vertical={false} />
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
                                                tickFormatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)}
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
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />

                                            <Bar
                                                yAxisId="left"
                                                dataKey="amountUSD"
                                                name="Alquiler USD"
                                                fill="#10b981"
                                                radius={[4, 4, 0, 0]}
                                                maxBarSize={50}
                                                fillOpacity={0.8}
                                                isAnimationActive={false}
                                            />

                                            <Line
                                                yAxisId="right"
                                                type="linear"
                                                dataKey="inflationAccum"
                                                name="Inf. Acum."
                                                stroke="#f59e0b"
                                                strokeWidth={2}
                                                dot={false}
                                                isAnimationActive={false}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="linear"
                                                dataKey="devaluationAccum"
                                                name="Dev. Acum."
                                                stroke="#f43f5e"
                                                strokeWidth={2}
                                                dot={false}
                                                isAnimationActive={false}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
