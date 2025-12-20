'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, LineChartIcon } from 'lucide-react';
import AccumulatedChart from '@/components/economic/AccumulatedChart';
import ExchangeRateGapChart from '@/components/economic/ExchangeRateGapChart';
import UVAEvolutionChart from '@/components/economic/UVAEvolutionChart';

export default function EconomicDataPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Datos Económicos</h1>
                    <p className="text-slate-400">
                        Análisis histórico de inflación, devaluación y evolución del valor de la UVA
                    </p>
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
