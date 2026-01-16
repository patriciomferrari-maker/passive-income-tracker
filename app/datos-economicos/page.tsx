'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, LineChartIcon, ArrowLeft, Calendar } from 'lucide-react';
import AccumulatedChart from '@/components/economic/AccumulatedChart';
import ExchangeRateGapChart from '@/components/economic/ExchangeRateGapChart';
import UVAEvolutionChart from '@/components/economic/UVAEvolutionChart';
import { getNextIndecReleaseDate, getDaysUntilNextRelease } from '@/app/lib/indec-calendar';
import ExchangeRateGapChart from '@/components/economic/ExchangeRateGapChart';
import UVAEvolutionChart from '@/components/economic/UVAEvolutionChart';
import Link from 'next/link';

export default function EconomicDataPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                    <div>
                        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-blue-400 transition-colors mb-4">
                            <ArrowLeft size={20} className="mr-2" />
                            Volver al Dashboard
                        </Link>
                        <h1 className="text-4xl font-bold text-white mb-2">Datos Económicos</h1>
                        <p className="text-slate-400">
                            Análisis histórico de inflación, devaluación y evolución del valor de la UVA
                        </p>
                    </div>

                    {/* INDEC Calendar Card */}
                    <Card className="bg-slate-900 border-slate-700 min-w-[300px]">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <Calendar size={24} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Próximo Dato IPC (INDEC)</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-xl font-bold text-white">
                                        {getNextIndecReleaseDate() ? new Date(getNextIndecReleaseDate()!).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : 'Fecha no disponible'}
                                    </h3>
                                    {getDaysUntilNextRelease() !== null && (
                                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${Number(getDaysUntilNextRelease()) <= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {getDaysUntilNextRelease()} días
                                        </span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Chart 1: Inflación y Devaluación Acumulada */}
                <AccumulatedChart />

                {/* Chart 2: TC Oficial vs Blue + Brecha */}
                <ExchangeRateGapChart />

                {/* Chart 3: Evolución UVA */}
                <UVAEvolutionChart />
            </div>
        </div>
    );
}
