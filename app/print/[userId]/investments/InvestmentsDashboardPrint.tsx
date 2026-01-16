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
        <div className="min-h-screen bg-[#020617] text-white p-4">
            <h1 className="text-3xl font-bold text-red-500">DEBUG MODE: DOES THIS RENDER?</h1>
            <pre className="text-xs text-slate-500 mt-4">
                {JSON.stringify(globalData, null, 2)}
            </pre>
        </div>
    );
}
