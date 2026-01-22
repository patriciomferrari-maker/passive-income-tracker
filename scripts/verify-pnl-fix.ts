
import { getUSDashboardStats } from '@/app/lib/investments/treasury-dashboard-stats';
import { getONDashboardStats } from '@/app/lib/investments/dashboard-stats';

const TARGET_USER_ID = 'cmkheox6o000010w6ubl2uf5c';

async function main() {
    console.log('--- Verifying P&L Fix (Zero Price Exclusion) ---');
    console.log('User:', TARGET_USER_ID);

    try {
        console.log('\n--- US Dashboard Stats ---');
        const usStats = await getUSDashboardStats(TARGET_USER_ID);
        console.log('Total Unrealized (Should exclude 0-price):', usStats.pnl?.unrealized);
        console.log('Capital Invertido (Basis for Unrealized):', usStats.capitalInvertido);
        console.log('Investments with 0 price/value:');
        usStats.investments
            .filter((i: any) => i.quantity > 0 && i.currentPrice <= 0)
            .forEach((i: any) => console.log(`- ${i.ticker}: Qty=${i.quantity}, Price=${i.currentPrice}`));

        // console.log('\n--- Arg Dashboard Stats (if any) ---');
        // const argStats = await getONDashboardStats(TARGET_USER_ID);
        // console.log('Total Unrealized:', argStats.pnl?.unrealized);

    } catch (e) {
        console.error(e);
    }
}

main();
