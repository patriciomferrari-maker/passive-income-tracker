import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Recalculate all rental cashflows affected by IPC changes
 * 
 * NOTE: In serverless environment (Vercel), we can't execute scripts directly.
 * This function logs the affected contracts and returns the count.
 * The actual recalculation should be triggered via:
 * 1. Manual script execution: npx tsx scripts/separate-regenerate.ts
 * 2. Scheduled cron job
 * 3. Webhook trigger
 */
export async function recalculateRentalsForIPCChange(ipcDate?: Date): Promise<number> {
    try {
        console.log('[Rental Recalc] Checking IPC-based contracts...');

        // Count contracts that use IPC adjustment
        const ipcContracts = await prisma.contract.findMany({
            where: {
                adjustmentType: 'IPC'
            },
            select: { id: true, propertyId: true }
        });

        if (ipcContracts.length === 0) {
            console.log('[Rental Recalc] No IPC-based contracts found');
            return 0;
        }

        console.log(`[Rental Recalc] Found ${ipcContracts.length} IPC-based contracts affected by IPC change`);
        console.log('[Rental Recalc] Note: Run "npx tsx scripts/separate-regenerate.ts" to recalculate cashflows');

        return ipcContracts.length;

    } catch (error: any) {
        console.error('[Rental Recalc] Error checking contracts:', error.message);
        // Don't throw - just log and return 0
        return 0;
    } finally {
        await prisma.$disconnect();
    }
}

// Allow running standalone for testing
if (require.main === module) {
    recalculateRentalsForIPCChange()
        .then((count) => {
            console.log(`✅ Found ${count} IPC-based rental contracts`);
            console.log('💡 Run "npx tsx scripts/separate-regenerate.ts" to recalculate');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error:', error);
            process.exit(1);
        });
}
