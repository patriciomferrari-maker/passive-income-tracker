
'use client';

import { useEffect, useState } from 'react';
import { DashboardCard } from '@/components/DashboardCard';
import { signOut } from 'next-auth/react';
import { Loader2, Clock, Menu, Settings, LogOut } from 'lucide-react';
import { FlagARG, FlagUSA } from '@/components/ui/CountryFlags';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const [isUnauthenticated, setIsUnauthenticated] = useState(false);

  useEffect(() => {
    // Initial fetch
    loadStats();

    // BFCache fix: Force reload/re-fetch if backend navigation restores page from cache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      } else {
        // Even if not persisted, re-check auth when showing page (e.g. tab switch/back sometimes)
        loadStats();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch(`/api/dashboard/stats?t=${new Date().getTime()}`);
      if (res.status === 401) {
        setIsUnauthenticated(true);
        setLoading(false);
        return;
      }
      const data = await res.json();

      if (data.needsOnboarding) {
        router.push('/onboarding');
        return;
      }

      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!loading && isUnauthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-lg">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            Passive Income
          </h1>
          <p className="text-slate-400 text-lg">
            Gestiona tus inversiones, controla tus gastos y seguí la evolución de tu patrimonio en un solo lugar.
          </p>
          <div className="pt-4">
            <Link
              href="/api/auth/signin"
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-11 px-8"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-slate-500 hover:text-red-400 transition-colors pt-1"
            >
              <LogOut size={20} />
            </button>
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
                            enabled={true}
                          />
                        )}

                        {(showAll || shouldShow('barbosa')) && (
                          <DashboardCard
                            title="Barbosa"
                            description="Gastos y Limpieza"
                            icon="🏠"
                            href="/barbosa"
                            count={0}
                            totalValue={0}
                            currency="ARS"
                            enabled={true}
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
