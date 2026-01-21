import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToGlobalAssets() {
    console.log('🔄 Migrating CEDEARs and ETFs to Global Assets...\n');

    try {
        // Find patriciomferrari user
        const user = await prisma.user.findUnique({
            where: { email: 'patriciomferrari@gmail.com' }
        });

        if (!user) {
            console.log('❌ User patriciomferrari@gmail.com not found');
            return;
        }

        console.log(`✅ Found user: ${user.name || user.email} (${user.id})\n`);

        // Get all CEDEARs and ETFs from this user
        const assets = await prisma.investment.findMany({
            where: {
                userId: user.id,
                type: { in: ['CEDEAR', 'ETF'] }
            },
            orderBy: { ticker: 'asc' }
        });

        console.log(`📊 Found ${assets.length} assets to migrate\n`);

        let created = 0;
        let skipped = 0;
        let holdings = 0;

        for (const asset of assets) {
            // Check if global asset already exists
            let globalAsset = await prisma.globalAsset.findUnique({
                where: { ticker: asset.ticker }
            });

            if (!globalAsset) {
                // Create global asset
                globalAsset = await prisma.globalAsset.create({
                    data: {
                        ticker: asset.ticker,
                        name: asset.name,
                        type: asset.type,
                        currency: asset.currency,
                        market: asset.market,
                        lastPrice: asset.lastPrice,
                        lastPriceDate: asset.lastPriceDate
                    }
                });
                console.log(`  ✅ Created GlobalAsset: ${asset.ticker} - ${asset.name}`);
                created++;
            } else {
                console.log(`  ⏭️  GlobalAsset exists: ${asset.ticker}`);
                skipped++;
            }

            // Check if user already has this holding
            const existingHolding = await prisma.userHolding.findUnique({
                where: {
                    userId_assetId: {
                        userId: user.id,
                        assetId: globalAsset.id
                    }
                }
            });

            if (!existingHolding) {
                // Create user holding
                await prisma.userHolding.create({
                    data: {
                        userId: user.id,
                        assetId: globalAsset.id
                    }
                });
                console.log(`    ✅ Created UserHolding for ${asset.ticker}`);
                holdings++;
            }

            // TODO: Migrate transactions if needed
            // For now, we keep transactions in the old Investment table
        }

        console.log('\n📊 Migration Summary:');
        console.log(`  ✅ Global Assets Created: ${created}`);
        console.log(`  ⏭️  Global Assets Skipped: ${skipped}`);
        console.log(`  🔗 User Holdings Created: ${holdings}`);
        console.log(`  📈 Total Assets: ${assets.length}`);

        console.log('\n⚠️  Note: Existing transactions remain in Investment table');
        console.log('   New transactions should use GlobalAssetTransaction');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

migrateToGlobalAssets()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
