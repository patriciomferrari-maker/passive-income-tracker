
import { getONDashboardStats, DashboardStats } from '@/app/lib/investments/dashboard-stats';
import InvestmentsDashboardPrint from './InvestmentsDashboardPrint';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string; market?: 'ARG' | 'USA' }>;
}

export default async function InvestmentsReportPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { market } = await searchParams;

    // Fetch unified dashboard stats (shared with Main Dashboard)
    const stats: DashboardStats = await getONDashboardStats(userId);

    // Prepare Global Data for the Print Component
    // Map stats to the GlobalData interface expected by the view
    // Note: We aggregate monthly flows here since the view expects summarized data
    // Aggregate monthly flows by type (Interest vs Limit)
    const monthlyFlowsMap: Record<string, { interest: number; amortization: number; sortKey: number }> = {};
    const today = new Date();

    // Sort by date first to ensure map insertion order (usually keys are ordered by insertion in JS, but better to map later)
    stats.upcomingPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(pay => {
        const d = new Date(pay.date);
        // Key: "MMM yyyy" to distinguish years
        const label = format(d, 'MMM yyyy', { locale: es });
        const sortKey = d.getFullYear() * 100 + d.getMonth();

        if (!monthlyFlowsMap[label]) {
            monthlyFlowsMap[label] = { interest: 0, amortization: 0, sortKey };
        }

        if (pay.type === 'INTEREST') {
            monthlyFlowsMap[label].interest += pay.amount;
        } else {
            // Amortization (or others)
            monthlyFlowsMap[label].amortization += pay.amount;
        }
    });

    const monthlyFlows = Object.entries(monthlyFlowsMap)
        .sort(([, a], [, b]) => a.sortKey - b.sortKey)
        .slice(0, 12) // Limit to 12 months
        .map(([label, data]) => ({
            monthLabel: label.charAt(0).toUpperCase() + label.slice(1), // Capitalize
            interest: data.interest,
            amortization: data.amortization,
            total: data.interest + data.amortization
        }));

    // Asset Allocation (for Pie Chart)
    const allocation = stats.portfolioBreakdown.map(item => ({
        name: item.ticker || 'Unknown',
        value: item.invested, // Or use currentValue? Usually allocation is by Market Value.
        // Wait, stats.portfolioBreakdown returns "invested" (Cost?). 
        // Let's check dashboard-stats.ts: "invested" is calculated from TRANSACTIONS (Historical Cost).
        // But for "Allocation", we usually want CURRENT VALUE.
        // Dashboard uses "invested" for the "TIR vs Mercado" but "Tenencia Valor Actual" for top card.
        // The Pie Chart in the Dashboard usually shows "Tenencia Valorizado".
        // Does `portfolioBreakdown` have current value? 
        // In `dashboard-stats.ts`: It returns `invested`, `percentage` (based on capitalInvertido), `tir`.
        // It does NOT explicitly return `currentValue` per asset in `portfolioBreakdown`.
        // However, `inv.value` was calculated in the first loop but NOT returned in the final map?
        // Let's check `dashboard-stats.ts` again.
        // Line 204: returns { ticker, name, invested, percentage, tir, type }. 
        // Missing `currentValue`.
        // I should stick to `invested` for now to match the "Cost Basis" breakdown, OR 
        // rely on strict consistency. 
        // Given the goal is "Make PDF look like Dashboard", and Dashboard Pie Chart usually uses Market Value...
        // But `route.ts` (original) also used `invested` for the `portfolioBreakdown` map!
        // So sticking to `invested` maintains consistency with the OLD route logic (which drove the dashboard).
        // So I will use `invested`.
        fill: '#3b82f6' // Color handling is done in View
    })).sort((a, b) => b.value - a.value);

    const globalData = {
        totalValueUSD: stats.totalCurrentValue, // Use Current Market Value (Tenencia)
        totalIncomeUSD: stats.totalACobrar, // Or projected? 
        // "Flujo Proyectado (12m)" card in Print uses `totalIncomeUSD`.
        // in stats we have `totalACobrar` (Capital + Interes PENDIENTE).
        // Does this match?
        // `totalACobrar` is "All future projected". 
        // View expects "Next 12 Months"? 
        // Let's filter `upcomingPayments` for 12 months sum.
        // Actually `stats.totalACobrar` includes ALL future.
        // Let's sum upcomingPayments (which is next 12m, wait, stats says upcoming is all future? No, route said slice 50).
        // `dashboard-stats.ts`: `upcomingPayments = allFuture.slice(0, 50)`. 
        // I will recalculate "Next 12m Income" specifically here to be precise.
        yieldAPY: stats.tirConsolidada,
        allocation,
        monthlyFlows
    };

    // Recalculate 12m Income strictly
    const next12m = new Date();
    next12m.setMonth(next12m.getMonth() + 12);
    const flow12m = stats.upcomingPayments
        .filter(p => new Date(p.date) <= next12m)
        .reduce((sum, p) => sum + p.amount, 0);

    globalData.totalIncomeUSD = flow12m;


    return (
        <InvestmentsDashboardPrint
            investments={stats.investments} // Raw list from stats
            globalData={globalData}
            stats={stats} // Pass full stats for new cards
            market={market || 'ARG'}
            reportDate={format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase()}
        />
    );
}
