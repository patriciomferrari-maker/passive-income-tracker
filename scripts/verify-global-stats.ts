
import { getUSDashboardStats } from '@/app/lib/investments/treasury-dashboard-stats';
import { getUserId } from '@/app/lib/auth-helper';

// Mock getUserId for script (or just pass known ID)
const TARGET_USER_ID = 'cmkheox6o000010w6ubl2uf5c';

async function main() {
    console.log('--- Verifying Global Asset Support in Stats ---');
    console.log('User:', TARGET_USER_ID);

    try {
        const stats = await getUSDashboardStats(TARGET_USER_ID);
        console.log('Total Investments:', stats.totalInvestments);
        console.log('Total Transactions:', stats.totalTransactions);
        console.log('Investments List:');
        stats.investments.forEach((i: any) => {
            console.log(`- ${i.ticker} (${i.type}): Qty=${i.quantity}, Price=${i.currentPrice}, Value=${i.marketValue}`);
        });

        const arkk = stats.investments.find((i: any) => i.ticker === 'ARKK');
        if (arkk) {
            console.log('\n[SUCCESS] ARKK found!');
            console.log('ARKK Value:', arkk.marketValue);
            console.log('ARKK Qty:', arkk.quantity);
        } else {
            console.error('\n[ERROR] ARKK NOT found in stats!');
        }

    } catch (e) {
        console.error(e);
    }
}

main();
