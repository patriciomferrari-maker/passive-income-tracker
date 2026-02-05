
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const missingSectorAssets = await prisma.globalAsset.findMany({
        where: {
            OR: [
                { sector: null },
                { sector: '' }
            ]
        },
        select: {
            ticker: true,
            name: true
        }
    });

    console.log(`Found ${missingSectorAssets.length} assets with missing sectors.`);
    console.log(JSON.stringify(missingSectorAssets, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
