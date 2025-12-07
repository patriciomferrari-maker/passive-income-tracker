import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Percent, ArrowDownRight, ArrowUpRight, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface DashboardData {
    capitalInvertido: number;
    capitalCobrado: number;
    interesCobrado: number;
    capitalACobrar: number;
    interesACobrar: number;
    totalTransactions: number;
    tirConsolidada: number;
    proximoPago: {
        date: string;
        amount: number;
        type: string;
        ticker: string;
        name: string;
    } | null;
}

interface VariantProps {
    data: DashboardData;
    formatMoney: (val: number) => string;
    showValues: boolean;
}

export function MinimalVariant({ data, formatMoney, showValues }: VariantProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Performance Card (Wide) */}
            <Card className="md:col-span-2 bg-slate-950 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-400 font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        Rendimiento General
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Inversión Total</p>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {formatMoney(data.capitalInvertido)}
                        </div>
                        <p className="text-xs text-slate-600 mt-2">{data.totalTransactions} operaciones activas</p>
                    </div>
                    <div className="border-l border-slate-800 pl-8">
                        <p className="text-sm text-slate-500 mb-1">TIR Consolidada</p>
                        <div className="text-3xl font-bold text-emerald-400 tracking-tight">
                            {showValues ? `${data.tirConsolidada.toFixed(2)}%` : '****'}
                        </div>
                        <p className="text-xs text-slate-600 mt-2">Retorno anualizado</p>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Next Payment (Compact) */}
            <Card className="bg-slate-950 border-slate-800 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Calendar className="h-24 w-24 text-white" />
                </div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-slate-400 font-medium text-sm">Próximo Pago</CardTitle>
                </CardHeader>
                <CardContent>
                    {data.proximoPago ? (
                        <div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {formatMoney(data.proximoPago.amount)}
                            </div>
                            <div className="text-sm text-slate-300 font-medium">
                                {data.proximoPago.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {format(new Date(data.proximoPago.date), 'dd MMMM yyyy')}
                            </div>
                        </div>
                    ) : (
                        <div className="text-slate-500">Sin pagos próximos</div>
                    )}
                </CardContent>
            </Card>

            {/* 3. Cashflow Breakdown (Grid) */}
            <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-950 border-l-4 border-l-blue-500 border-y-slate-800 border-r-slate-800">
                    <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Capital Cobrado</p>
                        <div className="text-xl font-bold text-white">{formatMoney(data.capitalCobrado)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-l-4 border-l-indigo-500 border-y-slate-800 border-r-slate-800">
                    <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Interés Cobrado</p>
                        <div className="text-xl font-bold text-white">{formatMoney(data.interesCobrado)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-l-4 border-l-purple-500 border-y-slate-800 border-r-slate-800">
                    <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Capital a Cobrar</p>
                        <div className="text-xl font-bold text-slate-300">{formatMoney(data.capitalACobrar)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-l-4 border-l-pink-500 border-y-slate-800 border-r-slate-800">
                    <CardContent className="pt-6">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Interés a Cobrar</p>
                        <div className="text-xl font-bold text-slate-300">{formatMoney(data.interesACobrar)}</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
