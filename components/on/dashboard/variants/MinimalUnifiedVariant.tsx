import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Percent, Calendar, ArrowDownRight, ArrowUpRight, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from 'date-fns/locale';

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

export function MinimalUnifiedVariant({ data, formatMoney, showValues }: VariantProps) {
    return (
        <div className="space-y-6">
            {/* 1. HERO CARD: Unified Investment, TIR, and Next Payment */}
            <Card className="bg-slate-950 border-slate-800 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800">

                    {/* Section A: Total Investment */}
                    <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-900/50 transition-colors">
                        <div className="mb-3 p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Inversión Total</p>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {formatMoney(data.capitalInvertido)}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {data.totalTransactions} operaciones activas
                        </p>
                    </div>

                    {/* Section B: Consolidated TIR */}
                    <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-900/50 transition-colors">
                        <div className="mb-3 p-3 rounded-full bg-blue-500/10 text-blue-500">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">TIR Consolidada</p>
                        <div className="text-3xl font-bold text-blue-400 tracking-tight">
                            {showValues ? `${data.tirConsolidada.toFixed(2)}%` : '****'}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Rendimiento anualizado
                        </p>
                    </div>

                    {/* Section C: Next Payment */}
                    <div className="p-6 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                        {/* Background accent for next payment */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 to-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="mb-3 p-3 rounded-full bg-purple-500/10 text-purple-500 z-10">
                            <Clock className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1 z-10">Próximo Pago</p>

                        {data.proximoPago ? (
                            <div className="z-10">
                                <div className="text-3xl font-bold text-white tracking-tight mb-1">
                                    {formatMoney(data.proximoPago.amount)}
                                </div>
                                <div className="text-sm font-medium text-purple-300 mb-1">
                                    {data.proximoPago.name}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {format(new Date(data.proximoPago.date), 'dd MMMM yyyy', { locale: es })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500 z-10">Sin pagos próximos</div>
                        )}
                    </div>
                </div>
            </Card>

            {/* 2. SECONDARY METRICS: Grid of 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Capital Cobrado */}
                <Card className="bg-slate-950 border-emerald-500/30 hover:border-emerald-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                                <ArrowDownRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">COBRADO</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Capital</p>
                            <div className="text-2xl font-bold text-white">{formatMoney(data.capitalCobrado)}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Interés Cobrado */}
                <Card className="bg-slate-950 border-emerald-500/30 hover:border-emerald-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                                <ArrowDownRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30">COBRADO</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Interés</p>
                            <div className="text-2xl font-bold text-white">{formatMoney(data.interesCobrado)}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Capital a Cobrar */}
                <Card className="bg-slate-950 border-amber-500/30 hover:border-amber-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:text-amber-300 transition-colors">
                                <ArrowUpRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">PENDIENTE</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Capital</p>
                            <div className="text-2xl font-bold text-amber-100">{formatMoney(data.capitalACobrar)}</div>
                        </div>
                    </CardContent>
                </Card>

                {/* Interés a Cobrar */}
                <Card className="bg-slate-950 border-amber-500/30 hover:border-amber-500/50 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:text-amber-300 transition-colors">
                                <ArrowUpRight className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">PENDIENTE</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-slate-400">Interés</p>
                            <div className="text-2xl font-bold text-amber-100">{formatMoney(data.interesACobrar)}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
