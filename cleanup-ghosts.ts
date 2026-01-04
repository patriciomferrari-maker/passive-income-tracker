import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting cleanup...');

    // 1. Find orphaned Transactions
    const orphanedTransactions = await prisma.transaction.findMany({
        where: {
            investment: {
                is: null
            }
        }
    });
    console.log(`Found ${orphanedTransactions.length} orphaned transactions.`);

    if (orphanedTransactions.length > 0) {
        const { count } = await prisma.transaction.deleteMany({
            where: {
                investment: {
                    is: null
                }
            }
        });
        console.log(`Deleted ${count} orphaned transactions.`);
    }

    // 2. Find orphaned Cashflows
    // Note: Cashflow relation is optional? No, it's defined as relation(fields: [investmentId]...)
    // But if onDelete was missing, the ID might still be there but pointing to nothing?
    // Prisma `where: { investment: { is: null } }` relies on foreign key constraints failing or being absent?
    // Actually, if the foreign key constraint exists in the DB, they might have been deleted.
    // But if "Ghost Data" exists, maybe they are linked to an investment that *does* exist but shouldn't?
    // Or maybe the user *assumes* they are deleted.

    // Let's also check for specific "Manual" cashflows or similar if relevant.
    // For now, standard orphan check:

    const orphanedCashflows = await prisma.cashflow.findMany({
        where: {
            investment: {
                is: null
            }
        }
    });

    console.log(`Found ${orphanedCashflows.length} orphaned cashflows.`);

    if (orphanedCashflows.length > 0) {
        const { count } = await prisma.cashflow.deleteMany({
            where: {
                investment: {
                    is: null
                }
            }
        });
        console.log(`Deleted ${count} orphaned cashflows.`);
    }

    console.log('Cleanup finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
