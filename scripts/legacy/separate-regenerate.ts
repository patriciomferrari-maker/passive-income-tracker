import { regenerateAllCashflows } from '../lib/rentals';

async function main() {
    console.log('🔄 Triggering Regeneration of All Cashflows (Centralized Logic)...');
    try {
        const count = await regenerateAllCashflows();
        console.log(`✅ Successfully regenerated cashflows for ${count} contracts.`);
    } catch (e) {
        console.error('❌ Error regenerating cashflows:', e);
    }
}

main();
