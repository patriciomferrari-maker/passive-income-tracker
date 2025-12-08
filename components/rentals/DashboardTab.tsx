'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { DollarSign, Calendar, Clock, Building2, TrendingUp, AlertCircle, Triangle, Minus, PieChart as PieChartIcon, Eye, EyeOff } from 'lucide-react';

interface ChartPoint {
    date: string;
    monthLabel: string;
    amountUSD: number;
    amountARS: number;
    inflationAccum: number;
    devaluationAccum: number;
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
    chartData: ChartPoint[];
}

interface DashboardTabProps {
    showValues: boolean;
}

export function DashboardTab({ showValues }: DashboardTabProps) {
    const [contractsData, setContractsData] = useState<ContractDashboardData[]>([]);
    const [globalData, setGlobalData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadResult = async () => {
            try {
                const [contractsRes, globalRes] = await Promise.all([
                    fetch('/api/rentals/dashboard'),
                    fetch('/api/rentals/global-dashboard')
                ]);

                const contractsJson = await contractsRes.json();
                const globalJson = await globalRes.json();

                if (Array.isArray(contractsJson)) {
                    setContractsData(contractsJson);
                }
                setGlobalData(globalJson);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadResult();
    }, []);

    const activeContracts = useMemo(() => {
        const now = new Date();
        return contractsData.filter(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            // Check if active (allowing some grace period or exact?) User said "vigente".
            // Let's say active if today <= end date. Even if start date is future? Maybe.
            // Usually "Active" means start <= now <= end.
            return now >= start && now <= end;
        });
    }, [contractsData]);

    const summaryMetrics = useMemo(() => {
        if (activeContracts.length === 0) return null;

        const now = new Date();

        // 1. Current Month Income
        let totalUSD = 0;
        let totalARS = 0;

        activeContracts.forEach(c => {
            const current = c.chartData.find(d => {
                const date = new Date(d.date);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });
            if (current) {
                totalUSD += current.amountUSD;
                if (c.currency === 'ARS') totalARS += current.amountARS;
            } else {
                const last = c.chartData[c.chartData.length - 1];
                if (last) {
                    totalUSD += last.amountUSD;
                    if (c.currency === 'ARS') totalARS += last.amountARS;
                }
            }
        });

        // 2. Next Expiration
        const expirations = activeContracts.map(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            return { ...c, endDate: end };
        }).filter(c => c.endDate >= now).sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

        const nextExpirationRaw = expirations[0];
        let nextExpiration = null;

        if (nextExpirationRaw) {
            const monthsDiff = (nextExpirationRaw.endDate.getFullYear() - now.getFullYear()) * 12 + (nextExpirationRaw.endDate.getMonth() - now.getMonth());
            // If current day < end day, add 1? Rough estimation is fine.
            nextExpiration = {
                ...nextExpirationRaw,
                monthsRemaining: Math.max(0, monthsDiff)
            };
        }

        // 3. Next Adjustment
        const upcomingAdjustments = activeContracts.map(c => {
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

        const nextAdjustmentRaw = upcomingAdjustments[0];
        let nextAdjustment = null;

        if (nextAdjustmentRaw) {
            const monthsDiff = (nextAdjustmentRaw.nextAdjDate.getFullYear() - now.getFullYear()) * 12 + (nextAdjustmentRaw.nextAdjDate.getMonth() - now.getMonth());
            nextAdjustment = {
                ...nextAdjustmentRaw,
                monthsRemaining: Math.max(0, monthsDiff)
            }
        }

        return {
            totalUSD,
            totalARS,
            nextExpiration,
            nextAdjustment,
            count: activeContracts.length
        };

    }, [activeContracts]);


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
                                {entry.name === 'Alquiler USD'
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

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white">Dashboard General</h2>

            {/* Top Summary Cards */}
            {summaryMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Income Card */}
                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-emerald-500">
                                <DollarSign size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Ingresos Mes Actual</span>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400">
                                {showValues
                                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(summaryMetrics.totalUSD)
                                    : '****'}
                            </h3>
                            {summaryMetrics.totalARS > 0 && (
                                <p className="text-xs text-slate-500 mt-1">
                                    + {showValues
                                        ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(summaryMetrics.totalARS)
                                        : '****'} (ARS)
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Next Expiration */}
                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-purple-500">
                                <Calendar size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Próximo Vencimiento</span>
                            </div>
                            {summaryMetrics.nextExpiration ? (
                                <>
                                    <h3 className="text-2xl font-bold text-white">
                                        {summaryMetrics.nextExpiration.propertyName}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-lg text-purple-400 font-medium">
                                            {summaryMetrics.nextExpiration.endDate.toLocaleDateString('es-AR')}
                                        </p>
                                        <span className="text-sm font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded uppercase">
                                            {summaryMetrics.nextExpiration.monthsRemaining} meses
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-500">Sin vencimientos próximos</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Next Adjustment */}
                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-amber-500">
                                <Clock size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Próxima Actualización</span>
                            </div>
                            {summaryMetrics.nextAdjustment ? (
                                <>
                                    <h3 className="text-2xl font-bold text-white">
                                        {summaryMetrics.nextAdjustment.propertyName}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-lg text-amber-500 font-medium">
                                            {summaryMetrics.nextAdjustment.nextAdjDate.toLocaleDateString('es-AR')}
                                        </p>
                                        <span className="text-sm font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded uppercase">
                                            {summaryMetrics.nextAdjustment.monthsRemaining} meses
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-500">Sin actualizaciones próximas</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Active Contracts */}
                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                            <div className="flex items-center gap-2 mb-2 text-blue-500">
                                <Building2 size={20} />
                                <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Contratos Activos</span>
                            </div>
                            <h3 className="text-3xl font-bold text-white">
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
                    {/* Global History Chart */}
                    <Card className="bg-slate-950 border-slate-800 lg:col-span-2 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-white">Evolución Ingresos Totales (USD)</CardTitle>
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
                                        <Bar dataKey="totalUSD" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingreso Total" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Currency Pie Chart */}
                    <Card className="bg-slate-950 border-slate-800 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeContracts.map((contract) => {
                    const lastInf = [...contract.chartData].reverse().find(d => d.inflationAccum !== 0)?.inflationAccum ?? 0;
                    const lastDev = [...contract.chartData].reverse().find(d => d.devaluationAccum !== 0)?.devaluationAccum ?? 0;

                    const lastRent = contract.chartData[contract.chartData.length - 1]?.amountUSD || 0;
                    const avgRent = contract.chartData.reduce((sum, d) => sum + d.amountUSD, 0) / (contract.chartData.length || 1);

                    return (
                        <Card key={contract.contractId} className="bg-slate-950 border-slate-800 shadow-lg">
                            <CardHeader className="border-b border-slate-800/50 pb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-white flex items-center gap-3">
                                            {contract.propertyName}
                                            <span className={`text-xs px-2 py-0.5 rounded border ${contract.currency === 'USD' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-blue-950 text-blue-400 border-blue-800'}`}>
                                                {contract.currency}
                                            </span>
                                        </CardTitle>
                                        <p className="text-sm text-slate-400 mt-1">{contract.tenantName || 'Inquilino'}</p>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <div className="flex flex-col items-end gap-1 text-right">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Último</span>
                                                <span className="text-xl font-mono font-bold text-white">
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
                                                <span className="text-xl font-mono font-bold text-white">
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
                                                <span className="text-sm text-white font-mono font-bold">{lastInf.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size={14} className="text-rose-500" />
                                                <span className="text-xs text-slate-400">Dev. Acum:</span>
                                                <span className="text-sm text-white font-mono font-bold">{lastDev.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="h-[300px] w-full">
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
                                                type="monotone"
                                                dataKey="inflationAccum"
                                                name="Inf. Acum."
                                                stroke="#f59e0b"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
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
        </div>
    );
}
