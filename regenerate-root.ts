
import { regenerateAllCashflows } from './lib/rentals';
import { prisma } from './lib/prisma';

async function main() {
    console.log('🔄 Triggering Regeneration of All Cashflows (Root Script)...');
    try {
        const count = await regenerateAllCashflows();
        console.log(`✅ Successfully regenerated cashflows for ${count} contracts.`);
    } catch (e) {
        console.error('❌ Error regenerating cashflows:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
