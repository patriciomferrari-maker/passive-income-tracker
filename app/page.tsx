'use client';

import { useEffect, useState } from 'react';
import { DashboardCard } from '@/components/DashboardCard';
import { Loader2, Clock } from 'lucide-react';
import { FlagARG, FlagUSA } from '@/components/ui/CountryFlags';

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
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Passive Income Tracker
          </h1>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-blue-400" size={48} />
          </div>
        )}

        {!loading && (
          <div className="max-w-4xl mx-auto space-y-12">
            {/* 1. Global Dashboard Access (Hero Card - Top) */}
            <DashboardCard
              title="Dashboard Global Consolidado"
              description="Visión unificada de ingresos, evolución y vencimientos"
              icon="📊"
              href="/dashboard"
              enabled={true}
            />

            {/* Quick Stats Row Removed - Moved to Dashboard Global */}

            {/* 2. Portfolio Cards (Grid - Bottom) */}
            {stats && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <DashboardCard
                    title="Cartera Argentina"
                    description="Obligaciones Negociables"
                    icon={<FlagARG className="w-12 h-8 rounded shadow-sm" />}
                    href="/investments/on"
                    count={stats.on.count}
                    totalValue={stats.on.totalInvested}
                    currency="USD"
                  />

                  <DashboardCard
                    title="Cartera USA"
                    description="US Treasuries"
                    icon={<FlagUSA className="w-12 h-8 rounded shadow-sm" />}
                    href="/investments/treasury"
                    count={stats.treasury.count}
                    totalValue={stats.treasury.totalInvested}
                    currency="USD"
                  />

                  <DashboardCard
                    title="Alquileres"
                    description="Propiedades en renta"
                    icon="🏢"
                    href="/alquileres"
                    count={stats.rentals?.count || 0}
                    totalValue={stats.rentals?.totalValue || 0}
                    currency="USD"
                  />

                  <DashboardCard
                    title="Deudas a Cobrar"
                    description="Prestamos y cuentas"
                    icon="💸"
                    href="/deudas"
                    count={stats.debts?.count || 0}
                    totalValue={stats.debts?.totalPending || 0}
                    currency="USD"
                  />
                  <DashboardCard
                    title="Banco"
                    description="Cantidad de inversiones"
                    icon="🏦"
                    href="/bank-investments"
                    count={stats.bank?.nextMaturitiesPF?.length || 0}
                    totalValue={stats.bank?.totalUSD || 0}
                    currency="USD"
                  />
                  <DashboardCard
                    title="Costa Esmeralda"
                    description="Alquileres y Mantenimiento"
                    icon="🏖️"
                    href="/costa-esmeralda"
                    count={0}
                    totalValue={0}
                    currency="USD"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
