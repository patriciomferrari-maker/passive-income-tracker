'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList, Label, ReferenceLine } from 'recharts';
import { TrendingUp, Wallet, ArrowUpRight, Eye, EyeOff, CalendarClock, HandCoins, Building2, Landmark, DollarSign, Calendar, Percent } from 'lucide-react';

interface GlobalStats {
    summary: {
        totalInvested: number;
        totalIdle: number;
        totalDebtReceivable: number;
        totalDebtPayable: number;
        tir: number;
        nextInterestON: { date: string, amount: number, name: string } | null;
        nextInterestTreasury: { date: string, amount: number, name: string } | null;
        nextRentalAdjustment: { date: string, property: string, properties: string[], monthsTo: number, count: number } | null;
        nextContractExpiration: { date: string, property: string, properties: string[], monthsTo: number, count: number } | null;
        totalMonthlyIncome: number;
        totalBankUSD: number;
        nextMaturitiesPF: Array<{ daysLeft: number, date: string, amount: number, alias: string }>;
    };
    history: {
        month: string;
        total: number;
        ON: number;
        Treasury: number;
        Rentals: number;
        Bank?: number;
    }[];
    composition: {
        name: string;
        value: number;
        fill: string;
    }[];
    projected: {
        month: string;
        total: number;
        Capital: number;
        Interest: number;
        BankInterest?: number;
    }[];
    debtDetails: {
        totalPending: number;
        totalPayable: number;
        receivables: {
            name: string;
            paid: number;
            pending: number;
            total: number;
            currency: string;
            details?: string;
        }[];
        payables: {
            name: string;
            paid: number;
            pending: number;
            total: number;
            currency: string;
            details?: string;
        }[];
    };
    enabledSections: string[];
    pnl?: {
        realized: number;
        unrealized: number;
    };
    bankComposition?: {
        name: string;
        value: number;
        fill: string;
    }[];
    portfolioDistribution?: {
        name: string;
        value: number;
    }[];
    debug?: { userId: string, raw: string | null };
}

export function GlobalDashboardTab() {
    const COLORS: any = {
        'Cartera Argentina': '#3b82f6',
        'Cartera USA': '#8b5cf6',
        'Inversiones Banco': '#f59e0b',
        'Plazo Fijo': '#4f46e5',
        'FCI': '#f59e0b',
        'Caja Ahorro': '#10b981',
        'Alquileres': '#10b981',
        'Otro': '#64748b'
    };
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        loadStats();
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }

        const handlePrivacyChange = () => {
            const savedPrivacy = localStorage.getItem('privacy_mode');
            if (savedPrivacy !== null) {
                setShowValues(savedPrivacy === 'true');
            }
        };
        window.addEventListener('privacy-changed', handlePrivacyChange);
        return () => window.removeEventListener('privacy-changed', handlePrivacyChange);
    }, []);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
        window.dispatchEvent(new Event('privacy-changed'));
    };

    const [errorType, setErrorType] = useState<'401' | 'generic' | null>(null);

    const loadStats = async () => {
        try {
            const res = await fetch('/api/dashboard/global', { cache: 'no-store' });

            if (res.status === 401) {
                console.error('Unauthorized access to dashboard');
                setStats(null);
                setErrorType('401');
                return;
            }

            if (!res.ok) {
                // Try to parse the error details from the server
                try {
                    const errorJson = await res.json();
                    console.error('Server returned detailed error:', errorJson);
                    if (errorJson.details) {
                        // We log it so the user can send us the screenshot of this specific error
                        console.error('SPECIFIC SERVER ERROR:', errorJson.details);
                    }
                } catch (e) { /* ignore parse error */ }

                throw new Error(`API Error: ${res.status}`);
            }

            const data = await res.json();

            if (!data || !data.summary) {
                console.error('Invalid data format received:', data);
                setStats(null);
                setErrorType('generic');
                return;
            }

            setStats(data);
            setErrorType(null);
        } catch (error) {
            console.error('Error loading global stats:', error);
            setStats(null);
            setErrorType('generic');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-slate-400">Cargando dashboard consolidado...</div>;

    if (errorType === '401') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-amber-500 text-xl font-medium">Sesión Expirada</div>
                <div className="text-slate-400">Por favor, iniciá sesión nuevamente para ver el dashboard.</div>
                <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    Ir al Login
                </a>
            </div>
        );
    }

    if (!stats) return <div className="text-center py-20 text-slate-400">No se pudieron cargar los datos.</div>;

    const formatMoney = (amount: number, currency = 'USD') => {
        if (!showValues) return '****';
        return currency === 'USD'
            ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const formatPercent = (val: number) => {
        if (!showValues) return '****';
        return `${(val * 100).toFixed(2)}%`;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
        return adjustedDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    };

    if (loading) return <div className="text-center py-20 text-slate-400">Cargando dashboard consolidado...</div>;
    if (!stats) return <div className="text-center py-20 text-slate-400">No se pudieron cargar los datos.</div>;

    // Filtering Logic
    const sections = stats.enabledSections || [];
    const showAll = sections.length === 0;

    const shouldShow = (id: string) => showAll || sections.includes(id);

    // Filter Data Helpers
    const filterHistoryKeys = (key: string) => {
        if (key === 'ON') return shouldShow('on');
        if (key === 'Treasury') return shouldShow('treasury');
        if (key === 'Rentals') return shouldShow('rentals');
        if (key === 'Bank') return shouldShow('bank');
        return true;
    };

    const filterComposition = (item: any) => {
        if (item.name === 'Obligaciones Negociables') return shouldShow('on');
        if (item.name === 'Treasuries') return shouldShow('treasury');
        if (item.name === 'Alquileres') return shouldShow('rentals');
        if (item.name === 'Intereses Banco') return shouldShow('bank');
        return true;
    };

    const filterDebt = () => shouldShow('debts');


    const historyData = showValues ? (stats.history || []) : [];
    const compositionData = showValues ? (stats.composition || []).filter(filterComposition) : [{ name: 'Oculto', value: 1, fill: '#1e293b' }];
    // Consolidated Portfolio Data (Market + Bank)
    const portfolioDistData = showValues ? (stats.portfolioDistribution || []) : [{ name: 'Oculto', value: 1 }];
    const projectedData = showValues ? (stats.projected || []) : [];

    // Check if Bank history exists for Chart Rendering
    const showBankHistory = historyData.some((h: any) => (h.Bank || 0) > 0);

    const renderTotalLabel = (props: any) => {
        const { x, y, width, value } = props;
        if (!showValues || !value) return null;
        return (
            <text x={x + width / 2} y={y - 10} fill="#fff" textAnchor="middle" fontSize={12} fontWeight="bold">
                {`$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </text>
        );
    };

    const renderCustomPieLabel = (props: any) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, x, y } = props;
        if (!showValues || percent <= 0.01) return null;

        // Calculate text anchor based on position relative to center
        const textAnchor = x > cx ? 'start' : 'end';

        return (
            <text x={x} y={y} fill="#fff" textAnchor={textAnchor} dominantBaseline="central" fontSize={11}>
                <tspan x={x} dy="-0.5em" fontWeight="bold" fill="#e2e8f0">{name}</tspan>
                <tspan x={x} dy="1.1em" fill="#94a3b8" fontSize={10}>{`${(percent * 100).toFixed(1)}%`}</tspan>
            </text>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Dashboard Consolidado</h2>
                    <p className="text-slate-400">Visión unificada de activos y eventos</p>

                </div>
                <button
                    onClick={togglePrivacy}
                    className="p-2 bg-slate-800 rounded-md text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors"
                >
                    {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>

            {/* ROW 1: KPIs & TIR */}
            <div className="flex flex-wrap gap-6">
                {/* 1. Inversiones (Cartera + PF/FCI) */}
                {(shouldShow('on') || shouldShow('treasury') || shouldShow('bank')) && (
                    <Card className="flex-1 min-w-[240px] bg-gradient-to-br from-blue-950/40 to-slate-900 border-blue-500/20 text-center flex flex-col items-center justify-center">
                        <CardHeader className="pb-2 flex flex-col items-center">
                            <CardTitle className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                <Landmark size={18} /> Inversiones Totales
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                            <div className="text-4xl font-bold text-white mb-1">{formatMoney(stats.summary.totalInvested)}</div>
                            <p className="text-sm text-blue-400">Cartera + Banco (Inv)</p>
                        </CardContent>
                    </Card>
                )}

                {/* 2. Monto sin invertir (Caja Ahorro/Seguridad/Cash) */}
                {shouldShow('bank') && (
                    <Card className="flex-1 min-w-[240px] bg-gradient-to-br from-slate-800 to-slate-950 border-slate-700 text-center flex flex-col items-center justify-center">
                        <CardHeader className="pb-2 flex flex-col items-center">
                            <CardTitle className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                <Wallet size={18} /> Monto sin Invertir
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                            <div className="text-4xl font-bold text-white mb-1">{formatMoney(stats.summary.totalIdle)}</div>
                            <p className="text-sm text-slate-400">Cajas Ahorro + Cash</p>
                        </CardContent>
                    </Card>
                )}

                {/* 3. Debts (Receivables / Payables) */}
                {/* 3a. Receivables */}
                {shouldShow('debts') && stats.summary.totalDebtReceivable > 0 && (
                    <Card className="flex-1 min-w-[240px] bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/20 text-center flex flex-col items-center justify-center">
                        <CardHeader className="pb-2 flex flex-col items-center">
                            <CardTitle className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                <HandCoins size={18} /> Deudas a Cobrar
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                            <div className="text-4xl font-bold text-white mb-1">{formatMoney(stats.summary.totalDebtReceivable)}</div>
                            <p className="text-sm text-emerald-400">Préstamos Activos</p>
                        </CardContent>
                    </Card>
                )}

                {/* 3b. Payables */}
                {shouldShow('debts') && (stats.summary.totalDebtPayable || 0) > 0 && (
                    <Card className="flex-1 min-w-[240px] bg-gradient-to-br from-rose-950/40 to-slate-900 border-rose-500/20 text-center flex flex-col items-center justify-center">
                        <CardHeader className="pb-2 flex flex-col items-center">
                            <CardTitle className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                <HandCoins size={18} /> Deudas a Pagar
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                            <div className="text-4xl font-bold text-white mb-1">{formatMoney(stats.summary.totalDebtPayable || 0)}</div>
                            <p className="text-sm text-rose-400">Saldo Pendiente</p>
                        </CardContent>
                    </Card>
                )}

                {/* 4. Total Consolidation */}
                <Card className="flex-1 min-w-[240px] bg-slate-950 border-slate-600 shadow-xl text-center flex flex-col items-center justify-center ring-1 ring-slate-700">
                    <CardHeader className="pb-2 flex flex-col items-center">
                        <CardTitle className="text-slate-300 text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
                            Patrimonio Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div className="text-4xl font-bold text-white mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {formatMoney(stats.summary.totalInvested + stats.summary.totalIdle + stats.summary.totalDebtReceivable)}
                        </div>
                        <p className="text-xs text-slate-500">Sumatoria Global</p>
                    </CardContent>
                </Card>
            </div>

            {/* ROW 1.5: Upcoming Events (Adaptive Flex) */}
            <div className="flex flex-wrap gap-6">
                {/* 0. Next Maturity PF */}


                {/* 1. Next Interest ON */}
                {shouldShow('on') && stats.summary.nextInterestON && (
                    <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-indigo-950/40 to-slate-900 border-indigo-500/20 text-center">
                        <CardHeader className="pb-2 flex flex-col items-center h-14 justify-center">
                            <CardTitle className="text-slate-300 text-sm font-bold uppercase tracking-wide">
                                Próximo Interés ON
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[160px] flex flex-col items-center justify-between pt-0 pb-4">
                            <>
                                <div className="h-10 flex items-center justify-center">
                                    <div className="text-3xl font-bold text-white">
                                        {formatMoney(stats.summary.nextInterestON.amount)}
                                    </div>
                                </div>
                                <div className="h-12 flex items-center justify-center w-full px-2">
                                    <span className="text-indigo-300 font-medium text-sm leading-tight line-clamp-2">
                                        {stats.summary.nextInterestON.name}
                                    </span>
                                </div>
                                <div className="h-10 flex items-center justify-center">
                                    <div className="text-lg font-bold text-white bg-slate-800/80 px-6 py-1.5 rounded-full border border-slate-700 shadow-sm">
                                        {formatDate(stats.summary.nextInterestON.date)}
                                    </div>
                                </div>
                            </>
                        </CardContent>
                    </Card>
                )}

                {/* 2. Next Interest Treasury */}
                {shouldShow('treasury') && stats.summary.nextInterestTreasury && (
                    <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-purple-950/40 to-slate-900 border-purple-500/20 text-center">
                        <CardHeader className="pb-2 flex flex-col items-center h-14 justify-center">
                            <CardTitle className="text-slate-300 text-sm font-bold uppercase tracking-wide">
                                Próximo Interés Treasury
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[160px] flex flex-col items-center justify-between pt-0 pb-4">
                            <>
                                <div className="h-10 flex items-center justify-center">
                                    <div className="text-3xl font-bold text-white">
                                        {formatMoney(stats.summary.nextInterestTreasury.amount)}
                                    </div>
                                </div>
                                <div className="h-12 flex items-center justify-center w-full px-2">
                                    <span className="text-purple-300 font-medium text-sm leading-tight line-clamp-2">
                                        {stats.summary.nextInterestTreasury.name}
                                    </span>
                                </div>
                                <div className="h-10 flex items-center justify-center">
                                    <div className="text-lg font-bold text-white bg-slate-800/80 px-6 py-1.5 rounded-full border border-slate-700 shadow-sm">
                                        {formatDate(stats.summary.nextInterestTreasury.date)}
                                    </div>
                                </div>
                            </>
                        </CardContent>
                    </Card>
                )}

                {/* 3. Next Rental Adjustment */}
                {shouldShow('rentals') && stats.summary.nextRentalAdjustment && (
                    <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/20 text-center">
                        <CardHeader className="pb-2 flex flex-col items-center h-14 justify-center">
                            <CardTitle className="text-slate-300 text-sm font-bold uppercase tracking-wide">
                                Próximo Ajuste Alquiler
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[160px] flex flex-col items-center justify-between pt-0 pb-4">
                            {stats.summary.nextRentalAdjustment.count === 1 ? (
                                <>
                                    <div className="h-10 flex items-center justify-center w-full px-2">
                                        <div className="text-xl font-bold text-white truncate">
                                            {stats.summary.nextRentalAdjustment.property}
                                        </div>
                                    </div>
                                    <div className="h-12 flex items-center justify-center w-full">
                                        <span className="text-emerald-300 text-sm font-medium">
                                            Faltan {stats.summary.nextRentalAdjustment.monthsTo} meses
                                        </span>
                                    </div>
                                    <div className="h-10 flex items-center justify-center">
                                        <div className="text-lg font-bold text-white bg-slate-800/80 px-6 py-1.5 rounded-full border border-slate-700 shadow-sm">
                                            {formatDate(stats.summary.nextRentalAdjustment.date)}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-10 flex items-center justify-center w-full px-2">
                                        <div className="text-xl font-bold text-white">
                                            {stats.summary.nextRentalAdjustment.count} Propiedades
                                        </div>
                                    </div>
                                    <div className="h-12 flex flex-col items-center justify-center w-full px-2 gap-0.5">
                                        {stats.summary.nextRentalAdjustment.properties.map((prop, idx) => (
                                            <div key={idx} className="text-emerald-300 text-xs truncate max-w-full">{prop}</div>
                                        ))}
                                    </div>
                                    <div className="h-10 flex items-center justify-center gap-2">
                                        <span className="text-emerald-300 text-xs font-medium">
                                            {stats.summary.nextRentalAdjustment.monthsTo}m
                                        </span>
                                        <div className="text-sm font-bold text-white bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700 shadow-sm">
                                            {formatDate(stats.summary.nextRentalAdjustment.date)}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* 4. Next Contract Expiration */}
                {shouldShow('rentals') && stats.summary.nextContractExpiration && (
                    <Card className="flex-1 min-w-[220px] bg-gradient-to-br from-orange-950/40 to-slate-900 border-orange-500/20 text-center">
                        <CardHeader className="pb-2 flex flex-col items-center h-14 justify-center">
                            <CardTitle className="text-slate-300 text-sm font-bold uppercase tracking-wide">
                                Próx. Vencimiento Contrato
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[160px] flex flex-col items-center justify-between pt-0 pb-4">
                            {stats.summary.nextContractExpiration.count === 1 ? (
                                <>
                                    <div className="h-10 flex items-center justify-center w-full px-2">
                                        <div className="text-xl font-bold text-white truncate">
                                            {stats.summary.nextContractExpiration.property}
                                        </div>
                                    </div>
                                    <div className="h-12 flex items-center justify-center w-full">
                                        <span className="text-orange-300 text-sm font-medium">
                                            Faltan {stats.summary.nextContractExpiration.monthsTo} meses
                                        </span>
                                    </div>
                                    <div className="h-10 flex items-center justify-center">
                                        <div className="text-lg font-bold text-white bg-slate-800/80 px-6 py-1.5 rounded-full border border-slate-700 shadow-sm">
                                            {formatDate(stats.summary.nextContractExpiration.date)}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-10 flex items-center justify-center w-full px-2">
                                        <div className="text-xl font-bold text-white">
                                            {stats.summary.nextContractExpiration.count} Propiedades
                                        </div>
                                    </div>
                                    <div className="h-12 flex flex-col items-center justify-center w-full px-2 gap-0.5">
                                        {stats.summary.nextContractExpiration.properties.map((prop, idx) => (
                                            <div key={idx} className="text-orange-300 text-xs truncate max-w-full">{prop}</div>
                                        ))}
                                    </div>
                                    <div className="h-10 flex items-center justify-center gap-2">
                                        <span className="text-orange-300 text-xs font-medium">
                                            {stats.summary.nextContractExpiration.monthsTo}m
                                        </span>
                                        <div className="text-sm font-bold text-white bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700 shadow-sm">
                                            {formatDate(stats.summary.nextContractExpiration.date)}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ROW 2: Bar Charts (History & Projection) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* History */}
                {historyData.length > 0 && (
                    <Card className="bg-slate-950 border-slate-800">
                        <CardHeader className="text-center">
                            <CardTitle className="text-white">Ingresos Últimos 12 Meses</CardTitle>
                            <CardDescription className="text-slate-400">Distribución de Ingresos</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historyData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} hide={!showValues} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} hide={!showValues} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(value: number) => showValues ? formatMoney(value) : '***'}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Bar dataKey="ON" stackId="a" fill="#3b82f6" name="ONs" />
                                    <Bar dataKey="Treasury" stackId="a" fill="#8b5cf6" name="Treasuries" />
                                    <Bar dataKey="Rentals" stackId="a" fill="#10b981" name="Alquileres">
                                        {!showBankHistory && <LabelList dataKey="total" content={renderTotalLabel} />}
                                    </Bar>
                                    {showBankHistory && (
                                        <Bar dataKey="Bank" stackId="a" fill="#f59e0b" name="Plazo Fijo / Banco" />
                                    )}
                                    <Bar dataKey="Installments" stackId="a" fill="#ef4444" name="Cuotas">
                                        <LabelList dataKey="total" content={renderTotalLabel} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Projection */}
                {/* Always render container if we have projection data structure, even if empty values, to avoid layout shift? 
                    Actually, logic says "some(p => p.total > 0)". 
                    If chart is "vacio" it might be because totals are 0. 
                */}
                <Card className="bg-slate-950 border-slate-800">
                    <CardHeader className="text-center">
                        <CardTitle className="text-white">Proyección 12 Meses</CardTitle>
                        <CardDescription className="text-slate-400">Flujo de Fondos por Activo</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectedData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} hide={!showValues} />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                    hide={!showValues}
                                    scale="sqrt"
                                />
                                {showValues && <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value: number) => formatMoney(value)}
                                    itemStyle={{ color: '#fff' }}
                                />}
                                {showValues && <Legend />}
                                <Bar dataKey="ON" stackId="a" fill="#3b82f6" name="ONs" />
                                <Bar dataKey="Treasury" stackId="a" fill="#8b5cf6" name="Treasuries" />
                                <Bar dataKey="Rentals" stackId="a" fill="#10b981" name="Alquileres" />
                                <Bar dataKey="PF" stackId="a" fill="#f59e0b" name="Plazo Fijo" />
                                <Bar dataKey="Installments" stackId="a" fill="#ef4444" name="Cuotas">
                                    <LabelList dataKey="total" content={renderTotalLabel} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ROW 3: Portfolio Composition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Portfolio Composition (Assets) */}
                {(shouldShow('on') || shouldShow('treasury') || shouldShow('bank')) && portfolioDistData && portfolioDistData.length > 0 && (
                    <Card className="bg-slate-950 border-slate-800">
                        <CardHeader className="text-center">
                            <CardTitle className="text-white">Composición de Cartera</CardTitle>
                            <CardDescription className="text-slate-400">Distribución de Activos</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={portfolioDistData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={renderCustomPieLabel}
                                        labelLine={showValues}
                                    >
                                        {portfolioDistData.map((entry, index) => {
                                            // Colors by type name
                                            let color = `hsl(${210 + (index * 40)}, 70%, 50%)`;
                                            if (entry.name === 'ON') color = '#3b82f6';
                                            else if (entry.name === 'Treasury') color = '#8b5cf6';
                                            else if (entry.name === 'Plazo Fijo') color = '#f59e0b';
                                            else if (entry.name === 'Caja de Ahorro') color = '#10b981';
                                            else if (entry.name === 'Caja de Seguridad') color = '#64748b';
                                            return <Cell key={`cell-p-${index}`} fill={color} stroke="rgba(0,0,0,0)" />;
                                        })}
                                        <Label
                                            value={formatMoney(stats.summary.totalInvested + stats.summary.totalIdle)} // Total Assets
                                            position="center"
                                            fill="#fff"
                                            fontSize={16}
                                            fontWeight="bold"
                                        />
                                        <Tooltip
                                            formatter={(value: number) => formatMoney(value)}
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', color: '#fff', paddingTop: '20px' }} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* 2. Income Composition (Last Month) */}
                {compositionData && compositionData.length > 0 && (
                    <Card className="bg-slate-950 border-slate-800">
                        <CardHeader className="text-center">
                            <CardTitle className="text-white">Composición de Ingresos</CardTitle>
                            <CardDescription className="text-slate-400">Fuente de Ingresos (Último Mes Reg.)</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={compositionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={renderCustomPieLabel}
                                        labelLine={showValues}
                                    >
                                        {compositionData.map((entry, index) => (
                                            <Cell key={`cell-c-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0)" />
                                        ))}
                                        <Label
                                            value={formatMoney(stats.summary.totalMonthlyIncome)}
                                            position="center"
                                            fill="#fff"
                                            fontSize={18}
                                            fontWeight="bold"
                                        />
                                        <Tooltip
                                            formatter={(value: number) => formatMoney(value)}
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', color: '#fff', paddingTop: '20px' }} />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ROW 4: Debts */}
            {/* ROW 4: Debts Detail */}
            {shouldShow('debts') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Receivables */}
                    {stats.debtDetails?.receivables?.length > 0 && (
                        <Card className={`bg-slate-950 border-slate-800 overflow-hidden ${!(stats.debtDetails?.payables?.length > 0) ? 'md:col-span-2' : ''}`}>
                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-emerald-400 text-lg flex items-center justify-center gap-2">
                                    <ArrowUpRight size={20} /> Cuentas por Cobrar
                                </CardTitle>
                                <CardDescription className="text-slate-400">Préstamos otorgados</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar p-4">
                                {stats.debtDetails.receivables.map((d, index) => (
                                    <div key={index} className="space-y-1">
                                        <div className="flex justify-between items-end">
                                            <span className="text-white font-medium text-sm">{d.name}</span>
                                            <span className="text-slate-500 text-xs">{d.details}</span>
                                        </div>
                                        {showValues && (
                                            <div className="relative h-6 w-full bg-slate-800 rounded overflow-hidden border border-slate-700">
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-emerald-600/50"
                                                    style={{ width: `${Math.min(100, (d.paid / d.total) * 100)}%` }}
                                                ></div>
                                                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-mono font-bold">
                                                    <span className="text-emerald-300 z-10">{formatMoney(d.paid)}</span>
                                                    <span className="text-white z-10">{formatMoney(d.pending)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {showValues && (
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>Cobrado</span>
                                                <span>Pendiente</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Payables */}
                    {stats.debtDetails?.payables?.length > 0 && (
                        <Card className={`bg-slate-950 border-slate-800 overflow-hidden ${!(stats.debtDetails?.receivables?.length > 0) ? 'md:col-span-2' : ''}`}>
                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-rose-400 text-lg flex items-center justify-center gap-2">
                                    <HandCoins size={20} /> Cuentas por Pagar
                                </CardTitle>
                                <CardDescription className="text-slate-400">Deudas</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar p-4">
                                {stats.debtDetails.payables.map((d, index) => (
                                    <div key={index} className="space-y-1">
                                        <div className="flex justify-between items-end">
                                            <span className="text-white font-medium text-sm">{d.name}</span>
                                            <span className="text-slate-500 text-xs">{d.details}</span>
                                        </div>
                                        {showValues && (
                                            <div className="relative h-6 w-full bg-slate-800 rounded overflow-hidden border border-slate-700">
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-rose-600/50"
                                                    style={{ width: `${Math.min(100, (d.paid / d.total) * 100)}%` }}
                                                ></div>
                                                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-mono font-bold">
                                                    <span className="text-rose-300 z-10">{formatMoney(d.paid)}</span>
                                                    <span className="text-white z-10">{formatMoney(d.pending)}</span>
                                                </div>
                                            </div>
                                        )}
                                        {showValues && (
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>Pagado</span>
                                                <span>Pendiente</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
