'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, addDays, differenceInDays } from 'date-fns';
import { Clock, TrendingUp, DollarSign, PieChart as PieChartIcon, EyeOff, List } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface BankDashboardTabProps {
    stats: {
        totalARS: number;
        totalUSD: number;
        estimatedInterest: number; // Keeping this for backward compat or aggregated value
    };
    operations: any[];
    showValues: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ef4444'];

export function BankDashboardTab({ stats, operations, showValues }: BankDashboardTabProps) {
    const activePFCount = operations.filter(op => op.type === 'PLAZO_FIJO').length;

    const formatMoney = (val: number, cur: string) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
    };

    // Pre-process and FILTER operations (Only Active)
    const processedOperations = operations.map(op => {
        let endDate = op.endDate;
        if (!endDate && op.type === 'PLAZO_FIJO' && op.startDate && op.durationDays) {
            endDate = addDays(new Date(op.startDate), op.durationDays).toISOString().split('T')[0];
        }
        return { ...op, endDate };
    }).filter(op => {
        // EXCLUDE EXPIRED PLAZO FIXOS
        if (op.type === 'PLAZO_FIJO' && op.endDate) {
            const today = new Date().toISOString().split('T')[0];
            return op.endDate >= today;
        }
        return true;
    });

    // 1. Calculate Interest for Current Year (PFs ending in current year)
    const currentYear = new Date().getFullYear();
    const activeAndFinishedPFs = processedOperations.filter(op => {
        if (op.type !== 'PLAZO_FIJO' || !op.endDate) return false;
        const year = parseInt(op.endDate.split('-')[0]);
        return year === currentYear;
    });

    const annualInterestUSD = activeAndFinishedPFs.reduce((sum, op) => {
        if (!op.amount || !op.tna || !op.durationDays) return sum;
        const interest = op.amount * (op.tna / 100) * (op.durationDays / 365);
        return sum + interest;
    }, 0);

    // 2. Next Maturity
    const todayStr = new Date().toISOString().split('T')[0];

    const futureOps = processedOperations
        .filter(op => op.endDate && op.endDate >= todayStr)
        .sort((a, b) => a.endDate!.localeCompare(b.endDate!));

    const nextMaturity = futureOps[0];

    // 3. Composition Data with %
    const getCompositionData = () => {
        const data: Record<string, number> = {};
        processedOperations.filter(op => op.currency === 'USD').forEach(op => {
            const label = op.alias || op.type.replace(/_/g, ' ');
            data[label] = (data[label] || 0) + op.amount;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    };
    // Group by Type > Currency for Detail View
    const groupedOperations = processedOperations.reduce((acc, op) => {
        const typeRaw = op.type || 'VARIOS';
        // Normalize type label (e.g. PLAZO_FIJO -> Plazo Fijo)
        const typeLabel = typeRaw.replace(/_/g, ' ');
        const currency = op.currency || 'ARS';

        // Composite key to separate currencies
        const key = `${typeRaw}-${currency}`;

        if (!acc[key]) {
            acc[key] = {
                id: key,
                label: typeLabel,
                currency: currency,
                total: 0,
                count: 0,
                items: []
            };
        }

        acc[key].total += op.amount;
        acc[key].count += 1;
        acc[key].items.push(op);
        return acc;
    }, {} as Record<string, { id: string, label: string, currency: string, total: number, count: number, items: any[] }>);

    const sortedGroups = Object.values(groupedOperations).sort((a, b) => {
        // Sort by currency first (USD top?), then total?
        // Let's just sort by total converted to roughly USD for ordering?
        // Or just Type alphabetical.
        // Let's do: USD groups first, then ARS? 
        if (a.currency !== b.currency) return a.currency === 'USD' ? -1 : 1;
        return b.total - a.total; // Descending amount
    });

    const compositionData = getCompositionData();
    const totalComposition = compositionData.reduce((sum, item) => sum + item.value, 0);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const val = payload[0].value;
            const percent = totalComposition ? ((val / totalComposition) * 100).toFixed(1) : 0;
            return (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded shadow-lg text-white">
                    <p className="font-bold mb-1">{payload[0].name}</p>
                    <p className="text-emerald-400 font-bold text-lg">
                        {showValues ? formatMoney(val, 'USD') : '****'}
                    </p>
                    <p className="text-slate-400 text-xs">{percent}%</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Total En USD */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Total en Banco (USD)</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white mb-1">
                            {showValues ? formatMoney(stats.totalUSD, 'USD') : '****'}
                        </div>
                        <p className="text-xs text-slate-500">Activos Totales</p>
                    </CardContent>
                </Card>

                {/* 2. Intereses Ganados This Year */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Intereses Ganados ({currentYear})</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400 mb-1">
                            {showValues ? `+${formatMoney(annualInterestUSD, 'USD')}` : '****'}
                        </div>
                        <p className="text-xs text-slate-500">Plazos Fijos USD (Cobrados + Devengados)</p>
                    </CardContent>
                </Card>

                {/* 3. Next Maturity (Top 3) */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-400">Próximos Vencimientos</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        {futureOps.length > 0 ? (
                            <div className="space-y-3">
                                {futureOps.slice(0, 3).map((op, idx) => {
                                    const daysLeft = differenceInDays(new Date(op.endDate!), new Date());
                                    return (
                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                                            <div>
                                                <div className="text-white font-medium">{(() => {
                                                    const [y, m, d] = new Date(op.endDate!).toISOString().split('T')[0].split('-').map(Number);
                                                    return format(new Date(y, m - 1, d, 12, 0, 0), 'dd/MM/yyyy');
                                                })()}</div>
                                                <div className={`font-bold mt-1 text-lg ${daysLeft <= 7 ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {daysLeft <= 0 ? 'HOY' : `${daysLeft} días`}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-emerald-400 font-bold">
                                                    {showValues ? formatMoney(op.amount, op.currency) : '****'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 mt-2">No hay vencimientos próximos</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Charts & Detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chart */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <PieChartIcon className="h-5 w-5 text-blue-400" />
                            Composición (USD)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {showValues ? (
                            compositionData.length > 0 ? (
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
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
                                                const RADIAN = Math.PI / 180;
                                                const radius = outerRadius + 20;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                                return (
                                                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                                        {`${name} (${(percent * 100).toFixed(0)}%)`}
                                                    </text>
                                                );
                                            }}
                                        >
                                            {compositionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    No hay datos en USD
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                                <EyeOff className="w-12 h-12 opacity-50" />
                                <span>Información oculta</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Detail View (Refactored Grouping) */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Detalle de Inversiones</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {sortedGroups.map((group) => (
                                <div key={group.id} className="space-y-2">
                                    {/* Group Header */}
                                    <div className="flex justify-between items-center bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-900 rounded text-blue-400">
                                                {group.label.includes('PLAZO') ? <Clock size={16} /> : <DollarSign size={16} />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white capitalize">{group.label.toLowerCase()}</div>
                                                <div className="text-xs text-slate-500 uppercase">{group.currency} • {group.count} ops</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-emerald-400 text-lg">
                                                {showValues ? formatMoney(group.total, group.currency) : '****'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="pl-4 space-y-1">
                                        {group.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm p-2 hover:bg-slate-800/30 rounded transition-colors border-l-2 border-slate-800 hover:border-blue-500">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-300 font-medium">{item.alias || item.bank || 'Sin nombre'}</span>
                                                    {item.endDate && (
                                                        <span className="text-[10px] text-slate-500">
                                                            Vence: {(() => {
                                                                const [y, m, d] = new Date(item.endDate).toISOString().split('T')[0].split('-').map(Number);
                                                                return format(new Date(y, m - 1, d, 12, 0, 0), 'dd/MM/yyyy');
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-medium text-slate-200 tabular-nums">
                                                    {showValues ? formatMoney(item.amount, item.currency) : '****'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {operations.length === 0 && (
                                <div className="text-center text-slate-500 py-4">No hay inversiones registradas</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
