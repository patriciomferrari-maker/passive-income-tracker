
import { regenerateAllCashflows } from '../lib/rentals';
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Starting full cashflow regeneration...');
    try {
        const count = await regenerateAllCashflows();
        console.log(`Successfully regenerated cashflows for ${count} contracts.`);
    } catch (error) {
        console.error('Error regenerating cashflows:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
