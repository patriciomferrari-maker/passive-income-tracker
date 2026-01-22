import { prisma } from '../lib/prisma';
import { updateGlobalAssets } from '../app/lib/market-data';

async function main() {
    console.log('=== Updating Global Asset Prices ===\n');

    // Check before
    const before = await prisma.globalAsset.findMany({
        where: { market: 'US', type: 'ETF' },
        select: { ticker: true, lastPrice: true }
    });
    console.log(`ETFs before update: ${before.filter(a => a.lastPrice).length}/${before.length} with prices\n`);

    // Run update
    console.log('Running updateGlobalAssets()...\n');
    const results = await updateGlobalAssets();

    const successes = results.filter(r => r.price !== null);
    const failures = results.filter(r => r.error);
    console.log(`\nCompleted: ${successes.length} successes, ${failures.length} failures\n`);

    // Check after
    const after = await prisma.globalAsset.findMany({
        where: { market: 'US', type: 'ETF' },
        select: { ticker: true, lastPrice: true, lastPriceDate: true },
        orderBy: { ticker: 'asc' }
    });

    console.log(`ETFs after update: ${after.filter(a => a.lastPrice).length}/${after.length} with prices\n`);
    console.log('All ETFs:');
    after.forEach(a => {
        const price = a.lastPrice ? `$${Number(a.lastPrice).toFixed(2)}` : 'NULL';
        const date = a.lastPriceDate ? a.lastPriceDate.toLocaleDateString('es-AR') : '-';
        console.log(`  ${a.ticker.padEnd(10)} ${price.padStart(10)} (${date})`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
