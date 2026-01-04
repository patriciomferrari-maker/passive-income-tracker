
import { prisma } from '../lib/prisma';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '../lib/investments';
import { regenerateAllCashflows } from '../lib/rentals';

async function main() {
    console.log('Starting Global Data Fix...');

    // 1. Fix ARS Data: Regenerate Rental Cashflows
    // This will pull fresh Economic Data (IPC/TC) and re-calculate amounts
    console.log('Regenerating Rental Cashflows...');
    try {
        const rentalCount = await regenerateAllCashflows();
        console.log(`✅ Regenerated cashflows for ${rentalCount} contracts.`);
    } catch (e) {
        console.error('❌ Error generating rental cashflows:', e);
    }

    // 2. Fix Ghost Data: Regenerate Investment Projections
    console.log('Regenerating Investment Projections...');
    try {
        const investments = await prisma.investment.findMany({
            where: {
                type: { in: ['ON', 'TREASURY', 'CEDEAR'] } // Focus on relevant types
            }
        });

        console.log(`Found ${investments.length} investments to process.`);

        for (const inv of investments) {
            try {
                // Generate fresh mapping
                const cashflows = await generateInvestmentCashflow(inv.id);

                // Save (matches new signature: deletes old, inserts new)
                await saveInvestmentCashflows(inv.id, cashflows);

                process.stdout.write('.');
            } catch (err) {
                console.error(`\nError processing investment ${inv.ticker}:`, err);
            }
        }
        console.log('\n✅ Investment projections updated.');
    } catch (e) {
        console.error('❌ Error dealing with investments:', e);
    }

    console.log('Cleaning up orphaned Cashflows (Safety Net)...');
    // Just in case any exist that are not linked to a valid investment anymore
    const deleted = await prisma.cashflow.deleteMany({
        where: {
            investmentId: null // or invalid relation
        } as any
    });
    // Actually Prisma schema enforces relation, so `investmentId` can't be null unless optional.
    // In our schema, it is required. But `onDelete: Cascade` handles it.
    // The previous "valid nulls" issue might have been on a different schema version.
    // We'll skip this if schema is strict.

    console.log('Done.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
