import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTable() {
    try {
        console.log('Checking GlobalAsset table...');
        // Try to count global assets. If table doesn't exist, this will fail.
        // But wait, the client types might not be updated if I didn't generate successfully with the new schema?
        // I ran `prisma generate` and it succeeded.
        // So `prisma.globalAsset` should exist on the client type.
        // If the DB doesn't have the table, the query will throw.

        // @ts-ignore - separate check in case types aren't fully perfectly aligned
        const count = await prisma.globalAsset.count();
        console.log(`Table exists! Found ${count} global assets.`);
    } catch (error: any) {
        console.error('Check failed:', error.message);
        if (error.message.includes('does not exist')) {
            console.log('Reason: Table GlobalAsset does not exist.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

checkTable();
