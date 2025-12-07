import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Percent, ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";
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

export function DefaultVariant({ data, formatMoney, showValues }: VariantProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Column 1: Inversión & TIR (Distinct Green Tones) */}
            <div className="flex flex-col gap-4 h-full">
                {/* Inversión Total (Emerald) */}
                <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Inversión Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-white">
                            {formatMoney(data.capitalInvertido)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {data.totalTransactions} operaciones
                        </p>
                    </CardContent>
                </Card>

                {/* TIR Consolidada (Lime/Green) */}
                <Card className="bg-gradient-to-br from-lime-500/20 to-lime-600/20 border-lime-500/30 flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                            <Percent className="h-4 w-4" />
                            TIR Consolidada
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-white">
                            {showValues ? `${data.tirConsolidada.toFixed(2)}%` : '****'}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Rendimiento anualizado
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Column 2: Capital (Unified Colors) */}
            <div className="flex flex-col gap-4 h-full">
                {/* Capital Cobrado (Blue) */}
                <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30 flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                            <ArrowDownRight className="h-4 w-4" />
                            Capital Cobrado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-white">
                            {formatMoney(data.capitalCobrado)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Amortizaciones recibidas
                        </p>
                    </CardContent>
                </Card>

                {/* Capital a Cobrar (Purple) */}
                <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30 flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                            <ArrowUpRight className="h-4 w-4" />
                            Capital a Cobrar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-white">
                            {formatMoney(data.capitalACobrar)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Column 3: Interés (Unified Colors) */}
            <div className="flex flex-col gap-4 h-full">
                {/* Interés Cobrado (Blue - Same as Capital Cobrado) */}
                <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30 flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                            <ArrowDownRight className="h-4 w-4" />
                            Interés Cobrado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-white">
                            {formatMoney(data.interesCobrado)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Cupones cobrados
                        </p>
                    </CardContent>
                </Card>

                {/* Interés a Cobrar (Purple - Same as Capital a Cobrar) */}
                <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30 flex-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                            <ArrowUpRight className="h-4 w-4" />
                            Interés a Cobrar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                        <div className="text-2xl font-bold text-white">
                            {formatMoney(data.interesACobrar)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Column 4: Próximo Pago */}
            <Card className="bg-white/5 border-white/10 h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Próximo Pago
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col justify-center items-center text-center h-[calc(100%-60px)]">
                    {data.proximoPago ? (
                        <div className="space-y-4 w-full">
                            <div>
                                <div className="text-4xl font-bold text-white mb-3">
                                    {formatMoney(data.proximoPago.amount)}
                                </div>
                                <div className="text-base text-slate-400 mb-1">
                                    {format(new Date(data.proximoPago.date), 'dd/MM/yyyy')}
                                </div>
                                <div className="text-lg font-medium text-slate-200">
                                    {data.proximoPago.name || data.proximoPago.ticker}
                                </div>
                            </div>
                            <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${data.proximoPago.type === 'INTEREST' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                {data.proximoPago.type === 'INTEREST' ? 'Interés' : 'Amortización'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-lg text-slate-400 text-center">Sin pagos programados</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
