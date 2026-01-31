
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Starting auto-subscription...');

    // 1. Get main user
    const user = await prisma.user.findFirst({
        where: { email: 'patriciomferrari@gmail.com' } // Adjust if needed or take first
    });

    if (!user) {
        console.error('User not found');
        return;
    }

    console.log(`Found user: ${user.email} (${user.id})`);

    // 2. Get all assets
    const assets = await prisma.globalAsset.findMany();
    console.log(`Found ${assets.length} global assets`);

    // 3. Create holdings if not exist
    let added = 0;
    for (const asset of assets) {
        const existing = await prisma.userHolding.findUnique({
            where: {
                userId_assetId: {
                    userId: user.id,
                    assetId: asset.id
                }
            }
        });

        if (!existing) {
            await prisma.userHolding.create({
                data: {
                    userId: user.id,
                    assetId: asset.id
                }
            });
            process.stdout.write('.');
            added++;
        }
    }

    console.log(`\n\nProcess complete! Added ${added} new holdings.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
