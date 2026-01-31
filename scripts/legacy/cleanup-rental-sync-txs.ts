
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupRentalSync() {
    console.log('Cleaning up rental sync transactions...');

    // Find count first
    const count = await prisma.barbosaTransaction.count({
        where: {
            importSource: {
                startsWith: 'RENTAL_SYNC_'
            }
        }
    });

    console.log(`Found ${count} synced transactions to delete.`);

    if (count > 0) {
        const deleted = await prisma.barbosaTransaction.deleteMany({
            where: {
                importSource: {
                    startsWith: 'RENTAL_SYNC_'
                }
            }
        });
        console.log(`✅ Deleted ${deleted.count} transactions.`);
    } else {
        console.log('No synced transactions found.');
    }
}

cleanupRentalSync()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
