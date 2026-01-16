
// scripts/test-shared-logic.ts
import { getONDashboardStats } from '../app/lib/investments/dashboard-stats';
import { prisma } from '../lib/prisma';

const USER_ID = 'cmixpqcnk00003mnmljva12cg'; // Patricio

async function main() {
    console.log("🚀 Testing Shared Dashboard Logic...");

    try {
        const stats = await getONDashboardStats(USER_ID);

        console.log("\n✅ Stats Computed Successfully:");
        console.log(`  - Valuation (Current): USD ${stats.totalCurrentValue.toLocaleString()}`);
        console.log(`  - Invested (Capital):  USD ${stats.capitalInvertido.toLocaleString()}`);
        console.log(`  - TIR Consolidada:     ${stats.tirConsolidada.toFixed(2)}%`);
        console.log(`  - ROI:                 ${stats.roi.toFixed(2)}%`);
        console.log(`  - Portfolio Items:     ${stats.totalONs}`);

        console.log("\n🧪 Breakdown Check (Top 3):");
        stats.portfolioBreakdown.slice(0, 3).forEach((p: any) => {
            console.log(`    * ${p.ticker}: Invested $${p.invested.toFixed(0)} | TIR ${p.tir.toFixed(1)}%`);
        });

        console.log("\n🔮 Upcoming Payments (Next 3):");
        stats.upcomingPayments.slice(0, 3).forEach((p: any) => {
            console.log(`    * ${p.date.toISOString().split('T')[0]} - ${p.ticker}: $${p.amount.toFixed(2)}`);
        });

    } catch (e) {
        console.error("❌ Error running shared logic:", e);
    }
}

main();
