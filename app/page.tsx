
'use client';

import { useEffect, useState } from 'react';
import { DashboardCard } from '@/components/DashboardCard';
import { signOutAction } from '@/app/lib/actions';
import { Loader2, Clock, Menu, Settings, LogOut } from 'lucide-react';
import { FlagARG, FlagUSA } from '@/components/ui/CountryFlags';
import Link from 'next/link';

interface DashboardStats {
  on: {
    count: number;
    totalInvested: number;
  };
  treasury: {
    count: number;
    totalInvested: number;
  };
  debts?: {
    count: number;
    totalPending: number;
  };
  rentals?: {
    count: number;
    totalValue: number;
  };
  bank?: {
    totalUSD: number;
    nextMaturitiesPF?: Array<{
      daysLeft: number;
      date: string;
      amount: number;
      alias: string;
    }>;
  };
  enabledSections?: string[];
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch(`/api/dashboard/stats?t=${new Date().getTime()}`);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <h1 className="text-4xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Passive Income Tracker
          </h1>

          <div className="absolute right-0 top-0 flex items-center gap-4">
            <Link href="/settings" className="text-slate-500 hover:text-blue-400 transition-colors">
              <Settings size={20} />
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="text-slate-500 hover:text-red-400 transition-colors pt-1">
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-blue-400" size={48} />
          </div>
        )}

        {/* Error State */}
        {!loading && (!stats || 'error' in stats) && (
          <div className="text-center py-10">
            <div className="text-red-400 mb-2">Error loading dashboard data</div>
            <div className="text-slate-500 text-sm">Please check the configuration</div>
            {stats && 'details' in stats && (
              <div className="mt-4 p-4 bg-red-950/50 rounded text-left mx-auto max-w-lg overflow-auto">
                <p className="font-mono text-xs text-red-200 whitespace-pre-wrap">{(stats as any).details}</p>
              </div>
            )}
          </div>
        )}

        {!loading && stats && !('error' in stats) && (
          <div className="max-w-4xl mx-auto space-y-12">
            {/* 1. Global Dashboard Access (Hero Card - Top) */}
            <DashboardCard
              title="Dashboard Global Consolidado"
              description="Visión unificada de ingresos, evolución y vencimientos"
              icon="📊"
              href="/dashboard"
              enabled={true}
            />

            {/* 2. Portfolio Cards (Grid - Bottom) */}
            {stats && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Helper to check visibility */}
                  {(() => {
                    const sections = stats.enabledSections || [];
                    const showAll = sections.length === 0; // Legacy users or no selection

                    const shouldShow = (id: string) => showAll || sections.includes(id);

                    return (
                      <>
                        {shouldShow('on') && (
                          <DashboardCard
                            title="Cartera Argentina"
                            description="ONs, CEDEARs y ETFs"
                            icon={<FlagARG className="w-12 h-8 rounded shadow-sm" />}
                            href="/investments/on"
                            count={stats.on.count}
                            totalValue={stats.on.totalInvested}
                            currency="USD"
                          />
                        )}

                        {shouldShow('treasury') && (
                          <DashboardCard
                            title="Cartera USA"
                            description="US Treasuries"
                            icon={<FlagUSA className="w-12 h-8 rounded shadow-sm" />}
                            href="/investments/treasury"
                            count={stats.treasury.count}
                            totalValue={stats.treasury.totalInvested}
                            currency="USD"
                          />
                        )}

                        {shouldShow('rentals') && (
                          <DashboardCard
                            title="Alquileres"
                            description="Propiedades en renta"
                            icon="🏢"
                            href="/alquileres"
                            count={stats.rentals?.count || 0}
                            totalValue={stats.rentals?.totalValue || 0}
                            currency="USD"
                          />
                        )}

                        {shouldShow('debts') && (
                          <DashboardCard
                            title="Deudas a Cobrar"
                            description="Prestamos y cuentas"
                            icon="💸"
                            href="/deudas"
                            count={stats.debts?.count || 0}
                            totalValue={stats.debts?.totalPending || 0}
                            currency="USD"
                          />
                        )}

                        {shouldShow('bank') && (
                          <DashboardCard
                            title="Banco"
                            description="Cantidad de inversiones"
                            icon="🏦"
                            href="/bank-investments"
                            count={stats.bank?.nextMaturitiesPF?.length || 0}
                            totalValue={stats.bank?.totalUSD || 0}
                            currency="USD"
                          />
                        )}

                        {/* Costa Card - Only show if specifically allowed OR legacy (showAll) */}
                        {(showAll || shouldShow('costa')) && (
                          <DashboardCard
                            title="Costa Esmeralda"
                            description="Alquileres y Mantenimiento"
                            icon="🏖️"
                            href="/costa-esmeralda"
                            count={0}
                            totalValue={0}
                            currency="USD"
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
