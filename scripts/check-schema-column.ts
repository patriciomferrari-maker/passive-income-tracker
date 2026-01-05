
import { prisma } from '@/lib/prisma';

async function main() {
    try {
        const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Transaction' AND column_name = 'notes';
    `;
        console.log('Column check result:', result);

        // Also try to select from it to be sure
        try {
            await prisma.$queryRaw`SELECT notes FROM "Transaction" LIMIT 1`;
            console.log('Successfully selected notes column.');
        } catch (e) {
            console.log('Failed to select notes column (it likely does not exist).');
        }

    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
