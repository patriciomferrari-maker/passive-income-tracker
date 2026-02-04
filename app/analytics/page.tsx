'use client';

import { SnowballChart } from '@/components/analytics/SnowballChart';
import { SectorChart } from '@/components/analytics/SectorChart';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function AnalyticsPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Analítica Avanzada
                    </h1>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Snowball - Full Width on Mobile, Half on Desktop */}
                    <div className="space-y-2">
                        <ErrorBoundary name="SnowballChart">
                            <SnowballChart />
                        </ErrorBoundary>
                        <p className="text-xs text-slate-500 text-center px-4">
                            * Muestra intereses proyectados/cobrados de ONs y Plazos Fijos, más dividendos.
                        </p>
                    </div>

                    {/* Sectors */}
                    <div className="space-y-2">
                        <ErrorBoundary name="SectorChart">
                            <SectorChart />
                        </ErrorBoundary>
                        <p className="text-xs text-slate-500 text-center px-4">
                            * Exposición estimada por sector industrial (Energía, Tech, Real Estate, etc.) based en activos.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
