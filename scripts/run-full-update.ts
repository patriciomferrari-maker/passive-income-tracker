
import 'dotenv/config';
import { updateGlobalAssets } from '../app/lib/market-data';

async function main() {
    console.log('🚀 Starting Full Market Data Update (Twelve Data w/ Yahoo Fallback)...');
    console.log('⏳ This process will take approximately 5 minutes due to API rate limiting.');

    try {
        const results = await updateGlobalAssets();

        console.log('\n📊 Summary of Updates:');
        let success = 0;
        let errors = 0;

        results.forEach(r => {
            if (r.price) {
                success++;
                console.log(`   ✅ ${r.ticker}: $${r.price} (${r.source})`);
            } else {
                errors++;
                console.log(`   ❌ ${r.ticker}: ${r.error} (${r.source})`);
            }
        });

        console.log(`\n🏁 Update Complete: ${success} updated, ${errors} failed.`);
    } catch (error: any) {
        console.error('\n❌ Fatal Error:', error.message);
    }
}

main();
