
import { PrismaClient } from '@prisma/client';
import { getUSDashboardStats } from '../app/lib/investments/treasury-dashboard-stats';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("User not found");

    console.log("Fetching stats for user:", user.email);
    const stats = await getUSDashboardStats(user.id);

    console.log("--- Verification Results ---");

    // 1. Verify ARKK Price
    const arkk = stats.investments.find(i => i.ticker === 'ARKK');
    if (arkk) {
        if (arkk.currentPrice > 0) {
            console.log(`PASS: ARKK has price ${arkk.currentPrice} (${arkk.marketValue})`);
        } else {
            console.error(`FAIL: ARKK has 0 price`);
        }
    } else {
        console.log("WARN: ARKK not found in portfolio (might be filtered out if quantity is 0, which is good if it's a ghost)");
    }

    // 2. Verify AGG is GONE
    const agg = stats.investments.find(i => i.ticker === 'AGG');
    if (!agg) {
        console.log("PASS: AGG is correctly filtered out (not in active investments)");
    } else {
        console.error(`FAIL: AGG is still present with Quantity: ${agg.quantity}, MarketValue: ${agg.marketValue}`);
    }

    // 3. Verify no other 0-quantity 0-pnl assets
    const ghosts = stats.investments.filter(i => Math.abs(i.quantity) < 0.000001 && Math.abs(i.realizedUSD || 0) < 0.01);
    if (ghosts.length === 0) {
        console.log("PASS: No other ghost assets found.");
    } else {
        console.log("FAIL: Found ghost assets:", ghosts.map(g => g.ticker).join(', '));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
