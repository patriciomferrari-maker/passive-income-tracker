
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
    totalIncome?: number;
    totalExpense?: number;
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
  userEmail?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

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
      console.log('[Dashboard] Fetching stats...');
      const res = await fetch(`/api/dashboard/stats?t=${new Date().getTime()}`);
      console.log('[Dashboard] Response status:', res.status);

      if (res.status === 401) {
        console.warn('[Dashboard] 401 Unauthorized');
        setIsUnauthenticated(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('[Dashboard] API Error:', text);
        throw new Error(`API Error: ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
      }

      const data = await res.json();
      console.log('[Dashboard] Data received:', data);

      if (data.needsOnboarding) {
        console.log('[Dashboard] Redirecting to onboarding (needsOnboarding=true)');
        router.push('/onboarding');
        return;
      }

      setStats(data);
    } catch (error: any) {
      console.error('Error loading dashboard stats:', error);
      setErrorDetails(error.message || 'Unknown Error');
    } finally {
      setLoading(false);
    }
  };

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!loading && isUnauthenticated) {
      window.location.href = '/login';
    }
  }, [loading, isUnauthenticated]);

  if (!loading && isUnauthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-lg">
          <Loader2 className="animate-spin text-blue-400 mx-auto" size={48} />
          <p className="text-slate-400">Redirigiendo a login...</p>
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
        {!loading && ((!stats && errorDetails) || (stats && 'error' in stats)) && (
          <div className="text-center py-10">
            <div className="text-red-400 mb-2">Error loading dashboard data</div>
            <div className="text-slate-500 text-sm">Please check the configuration</div>

            {/* Show specific error if available */}
            {errorDetails && (
              <div className="mt-4 p-4 bg-red-950/50 rounded text-left mx-auto max-w-lg overflow-auto border border-red-900">
                <p className="font-mono text-xs text-red-200 whitespace-pre-wrap">{errorDetails}</p>
              </div>
            )}

            {stats && 'details' in stats && (
              <div className="mt-4 p-4 bg-red-950/50 rounded text-left mx-auto max-w-lg overflow-auto">
                <p className="font-mono text-xs text-red-200 whitespace-pre-wrap">{(stats as any).details}</p>
              </div>
            )}
          </div>
        )}

        {!loading && stats && !('error' in stats) && (
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Global Dashboard Access (Hero Card - Top) */}
            <DashboardCard
              title="Dashboard Global Consolidado"
              description="Visión unificada de ingresos, evolución y vencimientos"
              icon="📊"
              href="/dashboard"
              enabled={true}
            />

            {/* Portfolio Cards (Grid - Bottom) */}
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
                            count={stats.rentals?.totalExpense ? undefined : (stats.rentals?.count || 0)}
                            totalValue={stats.rentals?.totalExpense ? undefined : (stats.rentals?.totalValue || 0)}
                            currency="USD"
                          >
                            {stats.rentals && (stats.rentals.totalExpense || 0) > 0 && (
                              <div className="w-full border-t border-slate-700 pt-4 mt-auto">
                                <div className="grid grid-cols-3 gap-2 divide-x divide-slate-800">
                                  <div className="flex flex-col items-center justify-center">
                                    <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Inversiones</p>
                                    <p className="text-lg font-bold text-white">{stats.rentals.count}</p>
                                  </div>
                                  <div className="flex flex-col items-center justify-center px-2">
                                    <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Ingresos</p>
                                    <p className="text-lg font-bold text-emerald-400 flex items-center gap-0.5">
                                      ${(stats.rentals.totalIncome || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-center justify-center px-2">
                                    <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Gastos</p>
                                    <p className="text-lg font-bold text-red-400 flex items-center gap-0.5">
                                      ${(stats.rentals.totalExpense || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DashboardCard>
                        )}

                        {shouldShow('debts') && (
                          <DashboardCard
                            title={(stats.debts?.totalPending || 0) >= 0 ? "Deudas a Cobrar" : "Deudas a Pagar"}
                            description={(stats.debts?.totalPending || 0) >= 0 ? "Prestamos y cuentas" : "Saldo Neto Deudor"}
                            icon="💸"
                            href="/deudas"
                            count={stats.debts?.count || 0}
                            totalValue={stats.debts?.totalPending || 0}
                            currency="USD"
                            trendColor={(stats.debts?.totalPending || 0) < 0 ? "text-rose-400" : undefined}
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

                        {shouldShow('crypto') && ['paato.ferrari@hotmail.com', 'patriciomferrari@gmail.com'].includes(stats.userEmail || '') && (
                          <DashboardCard
                            title="Crypto Portfolio"
                            description="Bitcoin, Ethereum y otras"
                            icon="₿"
                            href="/investments/crypto"
                            count={stats.crypto?.count || 0}
                            totalValue={stats.crypto?.totalValue || 0}
                            currency="USD"
                          />
                        )}

                        {/* Economic Data - Restricted to admin only */}
                        {['patriciomferrari@gmail.com', 'paato.ferrari@hotmail.com'].includes(stats.userEmail || '') && (
                          <DashboardCard
                            title="Datos Económicos"
                            description="Inflación, devaluación y UVA"
                            icon="📈"
                            href="/datos-economicos"
                            enabled={true}
                          />
                        )}

                        {/* Costa Card - Only show if specifically allowed OR legacy (showAll) */}
                        {(showAll || shouldShow('costa')) && (
                          <DashboardCard
                            title="Costa Esmeralda"
                            description="Alquileres y Mantenimiento"
                            icon="🏖️"
                            href="/costa-esmeralda"
                            count={stats.costa?.monthName || "Mes Actual"}
                            totalValue={stats.costa?.totalMonthly || 0}
                            currency="ARS"
                            enabled={true}
                            countLabel="Mes"
                            valueLabel="Total Gasto"
                            trendColor="text-red-400"
                          />
                        )}

                        {(showAll || shouldShow('barbosa')) && (
                          <DashboardCard
                            title="Hogar"
                            description="Gastos y Limpieza"
                            icon="🏠"
                            href="/barbosa"
                            count={stats.barbosa?.monthName || "Mes Actual"}
                            totalValue={stats.barbosa?.totalMonthly || 0}
                            currency="USD" // Now USD!
                            enabled={true}
                            countLabel="Mes"
                            valueLabel="Total Gasto"
                            trendColor="text-red-400"
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
