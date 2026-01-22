import { prisma } from '../lib/prisma';
import { updateGlobalAssets } from '../app/lib/market-data';

async function main() {
    console.log('=== Testing Global Asset Price Updates ===\n');

    // 1. Check current state
    console.log('1. Current Global Assets (before update):');
    const assetsBefore = await prisma.globalAsset.findMany({
        select: { ticker: true, lastPrice: true, lastPriceDate: true, market: true }
    });
    console.log(`   Total: ${assetsBefore.length} assets`);
    const withPrice = assetsBefore.filter(a => a.lastPrice !== null);
    const withoutPrice = assetsBefore.filter(a => a.lastPrice === null);
    console.log(`   With Price: ${withPrice.length}`);
    console.log(`   Without Price: ${withoutPrice.length}\n`);

    // 2. Run update
    console.log('2. Running updateGlobalAssets()...');
    const results = await updateGlobalAssets();
    console.log(`   Completed: ${results.length} results\n`);

    // 3. Check after update
    console.log('3. Global Assets (after update):');
    const assetsAfter = await prisma.globalAsset.findMany({
        select: { ticker: true, lastPrice: true, lastPriceDate: true, market: true }
    });
    const withPriceAfter = assetsAfter.filter(a => a.lastPrice !== null);
    const withoutPriceAfter = assetsAfter.filter(a => a.lastPrice === null);
    console.log(`   With Price: ${withPriceAfter.length}`);
    console.log(`   Without Price: ${withoutPriceAfter.length}\n`);

    // 4. Show sample results
    console.log('4. Sample Updated Prices:');
    const samples = assetsAfter.filter(a => a.lastPrice !== null).slice(0, 10);
    samples.forEach(a => {
        console.log(`   ${a.ticker} (${a.market}): $${a.lastPrice} (${a.lastPriceDate?.toLocaleDateString('es-AR')})`);
    });

    // 5. Show failures
    const failures = results.filter(r => r.error);
    if (failures.length > 0) {
        console.log(`\n5. Failures (${failures.length}):`);
        failures.slice(0, 5).forEach(f => {
            console.log(`   ${f.ticker}: ${f.error}`);
        });
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
