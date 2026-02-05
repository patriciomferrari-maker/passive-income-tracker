
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.globalAsset.findMany({
        where: {
            sector: { not: null }
        },
        select: { ticker: true, sector: true, type: true }
    });

    console.log(`Found ${assets.length} assets with sector populated.`);
    if (assets.length > 0) {
        console.log('Sample:', assets.slice(0, 5));
    } else {
        console.log('No assets have sectors yet.');
    }

    const total = await prisma.globalAsset.count();
    console.log(`Total GlobalAssets: ${total}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
