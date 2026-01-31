
import { scrapeAllUtilities } from '@/app/lib/utility-service';

async function main() {
    console.log('🏠 Testing Smart Home Service Integration...');
    try {
        const results = await scrapeAllUtilities();
        console.log('\n✅ Verification Complete!');
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('\n❌ Verification Failed:', e);
    }
}

main();
