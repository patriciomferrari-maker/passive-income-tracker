import { prisma } from '../lib/prisma';
import YahooFinance from 'yahoo-finance2';

async function main() {
    console.log('=== Testing Yahoo Finance v3 with Delays ===\n');

    const yahooFinance = new YahooFinance();
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const testTickers = ['SPY', 'QQQ', 'VOO'];

    for (let i = 0; i < testTickers.length; i++) {
        const ticker = testTickers[i];

        if (i > 0) {
            console.log(`  Waiting 1s...`);
            await delay(1000);
        }

        try {
            console.log(`Fetching ${ticker}...`);
            const quote = await yahooFinance.quote(ticker);

            if (quote && quote.regularMarketPrice) {
                console.log(`  ✓ ${ticker}: $${quote.regularMarketPrice}`);

                // Update DB
                const asset = await prisma.globalAsset.findFirst({
                    where: { ticker, market: 'US' }
                });

                if (asset) {
                    await prisma.globalAsset.update({
                        where: { id: asset.id },
                        data: {
                            lastPrice: quote.regularMarketPrice,
                            lastPriceDate: new Date()
                        }
                    });
                    console.log(`    Database updated`);
                }
            } else {
                console.log(`  ✗ ${ticker}: No price`);
            }
        } catch (e: any) {
            console.log(`  ✗ ${ticker}: ${e.message}`);
        }
    }

    // Verify
    console.log('\n--- Verification ---');
    const assets = await prisma.globalAsset.findMany({
        where: { ticker: { in: testTickers } },
        select: { ticker: true, lastPrice: true, lastPriceDate: true }
    });

    assets.forEach(a => {
        console.log(`  ${a.ticker}: $${a.lastPrice || 'NULL'} (${a.lastPriceDate?.toLocaleDateString('es-AR') || '-'})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
