
'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RealizedGainEvent {
    id: string;
    date: string; // ISO Date
    ticker: string;
    name?: string;
    quantity: number;
    sellPrice: number;
    buyPriceAvg: number;
    gainAbs: number;
    gainPercent: number;
    currency: string;
    type?: string;
}

interface RealizedGainsTableProps {
    types: string; // Comma separated, e.g. "ON,TREASURY"
    refreshTrigger?: number; // Prop to force refresh
}

export default function RealizedGainsTable({ types, refreshTrigger }: RealizedGainsTableProps) {
    const [gains, setGains] = useState<RealizedGainEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/investments/realized-gains?type=${types}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setGains(data.data);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [types, refreshTrigger]);

    if (gains.length === 0 && !loading) return null; // Hide if empty

    return (
        <Card className="bg-slate-900 border-slate-800 mt-8">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    Resultados Realizados
                    <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-[10px] font-normal">FIFO Method</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center p-4 text-xs text-slate-500">Calculando FIFO...</div>
                ) : (
                    <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-950">
                                <TableRow className="border-slate-800 hover:bg-slate-900">
                                    <TableHead className="text-slate-400 h-8 text-xs">Fecha Venta</TableHead>
                                    <TableHead className="text-slate-400 h-8 text-xs">Activo</TableHead>
                                    <TableHead className="text-slate-400 h-8 text-xs text-right">Nominales</TableHead>
                                    <TableHead className="text-slate-400 h-8 text-xs text-right">Precio Compra (Avg)</TableHead>
                                    <TableHead className="text-slate-400 h-8 text-xs text-right">Precio Venta</TableHead>
                                    <TableHead className="text-slate-400 h-8 text-xs text-right">Resultado</TableHead>
                                    <TableHead className="text-slate-400 h-8 text-xs text-right">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gains.map((gain) => (
                                    <TableRow key={gain.id} className="border-slate-800 hover:bg-slate-900/50">
                                        <TableCell className="h-8 text-xs py-1 text-slate-300">
                                            {new Date(gain.date).toLocaleDateString('es-AR')}
                                        </TableCell>
                                        <TableCell className="h-8 text-xs py-1 font-medium text-slate-200">
                                            <div className="flex flex-col">
                                                <span>{gain.ticker}</span>
                                                <span className="text-[9px] text-slate-500 font-normal">{gain.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="h-8 text-xs py-1 text-right text-slate-300">
                                            {gain.quantity.toLocaleString('es-AR')}
                                        </TableCell>
                                        <TableCell className="h-8 text-xs py-1 text-right text-slate-400">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: gain.currency }).format(gain.buyPriceAvg)}
                                        </TableCell>
                                        <TableCell className="h-8 text-xs py-1 text-right text-slate-200">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: gain.currency }).format(gain.sellPrice)}
                                        </TableCell>
                                        <TableCell className={`h-8 text-xs py-1 text-right font-bold ${gain.gainAbs >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {gain.gainAbs >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: gain.currency }).format(gain.gainAbs)}
                                        </TableCell>
                                        <TableCell className={`h-8 text-xs py-1 text-right font-bold ${gain.gainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {gain.gainPercent.toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
