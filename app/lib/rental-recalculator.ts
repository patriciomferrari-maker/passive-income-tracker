import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

/**
 * Recalculate all rental cashflows affected by IPC changes
 * This function runs the separate-regenerate script which recalculates
 * all rental periods based on current IPC values
 */
export async function recalculateRentalsForIPCChange(ipcDate?: Date): Promise<number> {
    try {
        console.log('[Rental Recalc] Starting rental recalculation...');

        // Count contracts that use IPC adjustment
        const ipcContracts = await prisma.contract.findMany({
            where: {
                adjustmentType: 'IPC'
            },
            select: { id: true }
        });

        if (ipcContracts.length === 0) {
            console.log('[Rental Recalc] No IPC-based contracts found');
            return 0;
        }

        console.log(`[Rental Recalc] Found ${ipcContracts.length} IPC-based contracts`);

        // Run the regenerate script
        // This script recalculates all rental cashflows based on current economic data
        const { stdout, stderr } = await execAsync(
            'npx tsx scripts/separate-regenerate.ts',
            { cwd: process.cwd() }
        );

        if (stderr) {
            console.error('[Rental Recalc] Script errors:', stderr);
        }

        console.log('[Rental Recalc] Script output:', stdout);
        console.log(`[Rental Recalc] Successfully recalculated ${ipcContracts.length} contracts`);

        return ipcContracts.length;

    } catch (error: any) {
        console.error('[Rental Recalc] Error recalculating rentals:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Allow running standalone for testing
if (require.main === module) {
    recalculateRentalsForIPCChange()
        .then((count) => {
            console.log(`✅ Recalculated ${count} rental contracts`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error:', error);
            process.exit(1);
        });
}
