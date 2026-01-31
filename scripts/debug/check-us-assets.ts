
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.globalAsset.findMany({
        where: { market: 'US' }
    });
    console.log(`Found ${assets.length} US Global Assets.`);
    if (assets.length > 0) {
        console.log('Sample:', assets.slice(0, 3));
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
