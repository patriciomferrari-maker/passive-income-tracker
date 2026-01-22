
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Global Asset Subscription...');

    // 1. Get the primary user (adjust email if necessary, or take the first one)
    const user = await prisma.user.findFirst();

    if (!user) {
        console.error('No user found!');
        process.exit(1);
    }

    console.log(`Found user: ${user.email} (${user.id})`);

    // 2. Get all Global Assets
    const assets = await prisma.globalAsset.findMany();
    console.log(`Found ${assets.length} global assets.`);

    // 3. Link each one to the user
    let createdCount = 0;
    let skippedCount = 0;

    for (const asset of assets) {
        // Check if exists/Upsert is safer
        // We want to ensure a UserHolding exists
        const existing = await prisma.userHolding.findUnique({
            where: {
                userId_assetId: {
                    userId: user.id,
                    assetId: asset.id,
                },
            },
        });

        if (!existing) {
            await prisma.userHolding.create({
                data: {
                    userId: user.id,
                    assetId: asset.id,
                },
            });
            createdCount++;
            // console.log(`Linked ${asset.ticker}`);
        } else {
            skippedCount++;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Summary:`);
    console.log(`- New Links Created: ${createdCount}`);
    console.log(`- Already Linked:    ${skippedCount}`);
    console.log('------------------------------------------------');
    console.log('All global assets are now in the portfolio.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
