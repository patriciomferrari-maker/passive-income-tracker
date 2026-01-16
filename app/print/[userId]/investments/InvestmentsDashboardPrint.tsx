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
    Legend
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
    monthlyFlows: { monthLabel: string; amountUSD: number }[];
}

interface Props {
    investments: Investment[];
    globalData: GlobalInvestmentData;
    market: 'ARG' | 'USA';
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
                            entry.name === 'Monto' || entry.name === 'Ingreso USD'
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(entry.value || 0)
                                : `${(entry.value || 0).toFixed(2)}%`
                        }
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function InvestmentsDashboardPrint({ investments, globalData, market }: Props) {
    const title = market === 'ARG' ? 'Cartera Argentina' : (market === 'USA' ? 'Cartera USA' : 'Reporte Global de Inversiones');
    const today = new Date();

    return (
        <div className="min-h-screen bg-[#020617] text-white p-4 space-y-8" style={{ width: '1200px', margin: '0 auto' }}>

            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">{title}</h1>
                    <p className="text-slate-400">Consolidado Mensual - {today.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="text-right">
                    <p className="text-emerald-400 font-mono font-bold text-xl">
                        Valuación: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(globalData.totalValueUSD)}
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                {/* Valuation */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-emerald-500">
                            <Wallet size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Valuación Total</span>
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(globalData.totalValueUSD)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            {investments.length} activos en cartera
                        </p>
                    </CardContent>
                </Card>

                {/* Projected Income (12 Months) */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-blue-500">
                            <DollarSign size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Flujo Proyectado (12m)</span>
                        </div>
                        <h3 className="text-2xl font-bold text-blue-400">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(globalData.totalIncomeUSD)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Rentabilidad bruta futura
                        </p>
                    </CardContent>
                </Card>

                {/* Yield Estimate */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-amber-500">
                            <TrendingUp size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Yield Estimado</span>
                        </div>
                        <h3 className="text-2xl font-bold text-amber-400">
                            {(globalData.yieldAPY || 0).toFixed(1)}%
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            TIR Promedio Ponderada
                        </p>
                    </CardContent>
                </Card>

                {/* Active Assets */}
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                        <div className="flex items-center gap-2 mb-2 text-purple-500">
                            <PieIcon size={20} />
                            <span className="text-sm font-semibold uppercase text-slate-400 tracking-wider">Diversificación</span>
                        </div>
                        <h3 className="text-2xl font-bold text-purple-400">
                            {globalData.allocation.length}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            clases de activos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            {/* <div className="grid grid-cols-2 gap-8 h-[400px]">
                <Card className="bg-slate-900/50 border-slate-800 break-inside-avoid">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-200 uppercase text-sm tracking-widest text-center">Distribución por Activo</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center h-[340px]">
                        <PieChart width={400} height={340}>
                            <Pie
                                data={globalData.allocation}
                                cx={200}
                                cy={150}
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={5}
                                dataKey="value"
                                isAnimationActive={false}
                            >
                                {globalData.allocation.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                            />
                        </PieChart>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 break-inside-avoid">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-200 uppercase text-sm tracking-widest text-center">Flujo de Fondos Proyectado</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center h-[340px]">
                        <BarChart
                            width={540}
                            height={300}
                            data={globalData.monthlyFlows}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            isAnimationActive={false}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="monthLabel" stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
                            <YAxis stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="amountUSD" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Ingreso USD" isAnimationActive={false} />
                        </BarChart>
                    </CardContent>
                </Card>
            </div> */}

            {/* Holdings Table */}
            <Card className="bg-slate-900/50 border-slate-800 break-inside-avoid mt-8">
                <CardHeader>
                    <CardTitle className="text-slate-200 uppercase text-sm tracking-widest">Detalle de Tenencias</CardTitle>
                </CardHeader>
                <CardContent>
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-900/80 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3">Ticker</th>
                                <th className="px-6 py-3">Nombre</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Cantidad</th>
                                <th className="px-6 py-3 text-right">Precio</th>
                                <th className="px-6 py-3 text-right">Valuación (USD)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {investments.map((inv) => {
                                const lastPrice = inv.currentPrice || 0;
                                const valuation = inv.quantity * lastPrice;
                                return (
                                    <tr key={inv.id} className="bg-slate-900/20 border-b border-slate-800 hover:bg-slate-800/30">
                                        <td className="px-6 py-4 font-bold text-slate-100">{inv.ticker || '-'}</td>
                                        <td className="px-6 py-4 truncate max-w-[200px]">{inv.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${inv.type === 'ON' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
                                                inv.type === 'CEDEAR' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' :
                                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                                }`}>
                                                {inv.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">{inv.quantity.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-400">${lastPrice.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(valuation)}
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
