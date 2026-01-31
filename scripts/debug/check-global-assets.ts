
import { prisma } from '../lib/prisma';

async function main() {
    try {
        const count = await prisma.globalAsset.count();
        console.log(`Global Assets in DB: ${count}`);

        if (count > 0) {
            const sample = await prisma.globalAsset.findMany({ take: 3 });
            console.log('Sample:', JSON.stringify(sample, null, 2));
        }
    } catch (error) {
        console.error('Error checking DB:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
