import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Percent, ArrowDownRight, ArrowUpRight, Calendar, PiggyBank, Coins } from "lucide-react";
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

export function BentoVariant({ data, formatMoney, showValues }: VariantProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[140px]">
            {/* 1. Main Investment (Large Square) */}
            <Card className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 border-none text-white flex flex-col justify-between">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-indigo-100">
                        <Wallet className="h-5 w-5" />
                        Portafolio Total
                    </CardTitle>
                </CardHeader>
                <CardContent className="pb-8">
                    <div className="text-5xl font-bold tracking-tighter mb-2">
                        {formatMoney(data.capitalInvertido)}
                    </div>
                    <div className="flex items-center gap-4 text-indigo-200">
                        <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-sm">
                            {data.totalTransactions} operaciones
                        </span>
                        <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-bold border border-emerald-500/30">
                            TIR {showValues ? `${data.tirConsolidada.toFixed(2)}%` : '****'}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Next Payment (Tall) */}
            <Card className="md:col-span-1 md:row-span-2 bg-zinc-900 border-zinc-800 flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Próximo Evento
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center items-center text-center p-4">
                    {data.proximoPago ? (
                        <>
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
                                <Coins className="h-6 w-6" />
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">
                                {formatMoney(data.proximoPago.amount)}
                            </div>
                            <div className="text-sm font-medium text-zinc-300 line-clamp-2 mb-2">
                                {data.proximoPago.name}
                            </div>
                            <div className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
                                {format(new Date(data.proximoPago.date), 'dd/MM/yyyy')}
                            </div>
                        </>
                    ) : (
                        <span className="text-zinc-500">Sin eventos</span>
                    )}
                </CardContent>
            </Card>

            {/* 3. Collected Stats (Stacked) */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex flex-col justify-center h-full">
                    <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3" /> Cobrado (Cap)
                    </div>
                    <div className="text-lg font-bold text-blue-400">{formatMoney(data.capitalCobrado)}</div>
                </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex flex-col justify-center h-full">
                    <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        <ArrowDownRight className="h-3 w-3" /> Cobrado (Int)
                    </div>
                    <div className="text-lg font-bold text-blue-400">{formatMoney(data.interesCobrado)}</div>
                </CardContent>
            </Card>

            {/* 4. Pending Stats (Stacked) */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex flex-col justify-center h-full">
                    <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> A Cobrar (Cap)
                    </div>
                    <div className="text-lg font-bold text-purple-400">{formatMoney(data.capitalACobrar)}</div>
                </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex flex-col justify-center h-full">
                    <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> A Cobrar (Int)
                    </div>
                    <div className="text-lg font-bold text-purple-400">{formatMoney(data.interesACobrar)}</div>
                </CardContent>
            </Card>
        </div>
    );
}
