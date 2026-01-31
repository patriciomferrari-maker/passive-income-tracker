import { prisma } from '../lib/prisma';

async function main() {
    const etfs = await prisma.globalAsset.findMany({
        where: { market: 'US', type: 'ETF' },
        select: { ticker: true, lastPrice: true, lastPriceDate: true },
        orderBy: { ticker: 'asc' }
    });

    console.log('Total ETFs:', etfs.length);
    console.log('With Price:', etfs.filter(a => a.lastPrice).length);
    console.log('Without Price:', etfs.filter(a => !a.lastPrice).length);
    console.log('\nAll ETFs:');
    etfs.forEach(a => {
        const price = a.lastPrice ? `$${a.lastPrice}` : 'NULL';
        const date = a.lastPriceDate ? a.lastPriceDate.toLocaleDateString('es-AR') : '-';
        console.log(`  ${a.ticker.padEnd(10)} ${price.padStart(10)} (${date})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
