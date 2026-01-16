'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList
} from 'recharts';
import { DollarSign, PieChart as PieIcon, TrendingUp, Calendar, Wallet } from 'lucide-react';

interface InvestmentTransaction {
    id: string;
    date: string; // Serialized Date
    type: string; // BU, SE, DI, IN, AM
    amount: number;
    price: number;
    currency: string;
    totalAmount: number;
}

interface InvestmentCashflow {
    id: string;
    date: string; // Serialized Date
    amount: number;
    currency: string;
    type: string;
    status: string;
}

interface Investment {
    id: string;
    ticker: string | null;
    name: string;
    type: string; // ON, CEDEAR, FCI
    market: string;
    currency: string;
    quantity: number;
    currentPrice: number | null;
    maturityDate?: string | null; // Serialized Date
    emissionDate?: string | null; // Serialized Date
    lastPriceDate?: string | null; // Serialized Date
    createdAt: string; // Serialized Date
    updatedAt: string; // Serialized Date
    transactions: InvestmentTransaction[];
    cashflows: InvestmentCashflow[]; // Projected flows
}

interface GlobalInvestmentData {
    totalValueUSD: number;
    totalIncomeUSD: number; // Next 12 months projected
    yieldAPY: number; // Approximate
    allocation: { name: string; value: number; fill: string }[];
    monthlyFlows: { monthLabel: string; interest: number; amortization: number; total: number }[];
}

// Use DashboardStats for extended data
import { DashboardStats } from '@/app/lib/investments/dashboard-stats';

interface Props {
    investments: Investment[];
    globalData: GlobalInvestmentData;
    stats: DashboardStats; // New prop
    market: 'ARG' | 'USA';
    reportDate: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-slate-700 p-2 rounded shadow-lg">
                <p className="text-slate-200 text-xs font-bold mb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-xs" style={{ color: entry.color }}>
                        {entry.name}: {
                            entry.name.includes('TIR') || entry.name.includes('Yield')
                                ? `${(entry.value || 0).toFixed(2)}%`
                                : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(entry.value || 0)
                        }
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function InvestmentsDashboardPrint({ investments, globalData, stats, market, reportDate }: Props) {
    const title = market === 'ARG' ? 'Cartera Argentina' : (market === 'USA' ? 'Cartera USA' : 'Reporte Global de Inversiones');

    // Prepare TIR Chart Data
    const tirChartData = stats?.portfolioBreakdown
        ?.map((p: any) => ({
            ticker: p.ticker,
            userTir: p.tir,
            marketTir: p.theoreticalTir || 0 // Assuming theoreticalTir is market benchmark
        }))
        .sort((a: any, b: any) => b.userTir - a.userTir)
        .slice(0, 8) || [];

    return (
        <div className="min-h-screen bg-[#020617] text-white p-4 space-y-6" style={{ width: '1200px', margin: '0 auto' }}>

            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">{title}</h1>
                    <p className="text-slate-400">Consolidado Mensual - {reportDate}</p>
                </div>
                <div className="text-right">
                    <p className="text-emerald-400 font-mono font-bold text-xl">
                        Valuación: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(globalData.totalValueUSD)}
                    </p>
                </div>
            </div>

            {/* Top KPI Cards (High Level) */}
            <div className="grid grid-cols-4 gap-4">
                {/* Total Investment (New) */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-emerald-500">
                            <Wallet size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Inversión Total</span>
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats?.capitalInvertido || 0)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{stats?.totalTransactions} operaciones</p>
                    </CardContent>
                </Card>

                {/* Valuation */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-emerald-500">
                            <TrendingUp size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Valuación Total</span>
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(globalData.totalValueUSD)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">{investments.length} activos</p>
                    </CardContent>
                </Card>

                {/* Consolidated Yield */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-amber-500">
                            <TrendingUp size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">TIR Consolidada</span>
                        </div>
                        <h3 className="text-2xl font-bold text-amber-400">
                            {(stats?.tirConsolidada || globalData.yieldAPY || 0).toFixed(2)}%
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Rentabilidad Real (XIRR)</p>
                    </CardContent>
                </Card>

                {/* Projected Income */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-blue-500">
                            <DollarSign size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Flujo Futuro (12m)</span>
                        </div>
                        <h3 className="text-2xl font-bold text-blue-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(globalData.totalIncomeUSD)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Próx. 12 meses</p>
                    </CardContent>
                </Card>
            </div>

            {/* Cashflow Breakdown Cards */}
            {stats && (
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardHeader className="p-3 pb-1 justify-center"><CardTitle className="text-xs uppercase text-emerald-500 tracking-wider text-center">Capital Cobrado</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-0 text-center">
                            <span className="text-xl font-mono text-emerald-400 font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.capitalCobrado)}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardHeader className="p-3 pb-1 justify-center"><CardTitle className="text-xs uppercase text-emerald-500 tracking-wider text-center">Interés Cobrado</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-0 text-center">
                            <span className="text-xl font-mono text-emerald-400 font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.interesCobrado)}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardHeader className="p-3 pb-1 justify-center"><CardTitle className="text-xs uppercase text-amber-500 tracking-wider text-center">Capital Pendiente</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-0 text-center">
                            <span className="text-xl font-mono text-amber-400 font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.capitalACobrar)}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/30 border-slate-800">
                        <CardHeader className="p-3 pb-1 justify-center"><CardTitle className="text-xs uppercase text-amber-500 tracking-wider text-center">Interés Pendiente</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-0 text-center">
                            <span className="text-xl font-mono text-amber-400 font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(stats.interesACobrar)}</span>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Charts Area */}
            <div className="grid grid-cols-2 gap-8 h-[350px]">
                {/* TIR Comparison Chart */}
                <Card className="bg-slate-900/50 border-slate-800 break-inside-avoid">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-200 uppercase text-sm tracking-widest text-center">TIR vs Mercado</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center h-[300px]">
                        <BarChart
                            width={540}
                            height={280}
                            data={tirChartData}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            isAnimationActive={false}
                            barGap={2}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="ticker" stroke="#475569" tick={{ fill: '#475569', fontSize: 10 }} interval={0} />
                            <YAxis stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(val) => `${val}%`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="marketTir" fill="#8b5cf6" name="TIR Mercado" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                                <LabelList dataKey="marketTir" position="top" fill="#8b5cf6" fontSize={10} formatter={(val: number) => val.toFixed(1) + '%'} />
                            </Bar>
                            <Bar dataKey="userTir" fill="#10b981" name="Tu TIR" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                                <LabelList dataKey="userTir" position="top" fill="#10b981" fontSize={10} formatter={(val: number) => val.toFixed(1) + '%'} />
                            </Bar>
                        </BarChart>
                    </CardContent>
                </Card>

                {/* Projected Flows (Stacked) */}
                <Card className="bg-slate-900/50 border-slate-800 break-inside-avoid">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-200 uppercase text-sm tracking-widest text-center">Flujo Mensual (Próx. 12)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center h-[300px]">
                        <BarChart
                            width={540}
                            height={280}
                            data={globalData.monthlyFlows}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            isAnimationActive={false}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="monthLabel" stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
                            <YAxis stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="interest" stackId="a" fill="#10b981" name="Interés" isAnimationActive={false} />
                            <Bar dataKey="amortization" stackId="a" fill="#3b82f6" name="Amortización" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="total" position="top" fill="#cbd5e1" fontSize={10} formatter={(val: number) => `$${val.toFixed(0)}`} />
                            </Bar>
                        </BarChart>
                    </CardContent>
                </Card>
            </div>

            {/* Holdings Table */}
            <Card className="bg-slate-900/50 border-slate-800 break-inside-avoid mt-4">
                <CardHeader>
                    <CardTitle className="text-slate-200 uppercase text-sm tracking-widest">Detalle de Tenencias</CardTitle>
                </CardHeader>
                <CardContent>
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-900/80 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3">Ticker</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Cantidad</th>
                                <th className="px-6 py-3 text-right">Precio</th>
                                <th className="px-6 py-3 text-right">Valuación</th>
                                <th className="px-6 py-3 text-right">TIR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {investments.map((inv) => {
                                const lastPrice = Number(inv.currentPrice || 0);
                                const quantity = Number(inv.quantity || 0);
                                const valuation = quantity * lastPrice;
                                // Find extra TIR data from stats if available
                                const invStat = stats?.portfolioBreakdown?.find((p: any) => p.ticker === inv.ticker);
                                const tir = invStat ? invStat.tir : 0;

                                return (
                                    <tr key={inv.id} className="bg-slate-900/20 border-b border-slate-800 hover:bg-slate-800/30">
                                        <td className="px-6 py-4 font-bold text-slate-100">{inv.ticker || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${inv.type === 'ON' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                                                inv.type === 'CEDEAR' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' :
                                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                                }`}>
                                                {inv.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">{quantity.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-400">${lastPrice.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(valuation)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-amber-400">
                                            {tir ? `${tir.toFixed(1)}%` : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

        </div>
    );
}
