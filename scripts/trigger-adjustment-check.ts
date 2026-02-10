import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Import the contract helper function
async function main() {
    console.log('\n🔔 Triggering manual contract adjustment check...\n');

    // Dynamically import to avoid module issues
    const { checkContractAdjustments } = await import('../app/lib/contract-helper');

    try {
        await checkContractAdjustments();
        console.log('\n✅ Contract adjustment check completed!');
        console.log('   Si hay contratos que deban ajustar, se enviaron las notificaciones.\n');
    } catch (error: any) {
        console.error('\n❌ Error during adjustment check:');
        console.error(error.message);
        console.error(error.stack);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
