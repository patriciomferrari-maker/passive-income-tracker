import { prisma } from '../lib/prisma';
import YahooFinance from 'yahoo-finance2';

async function main() {
    console.log('=== Debugging Global Asset Price Update ===\n');

    const yahooFinance = new YahooFinance();

    // Test with just a few ETFs
    const testTickers = ['SPY', 'QQQ', 'VOO'];

    for (const ticker of testTickers) {
        console.log(`\n--- Testing ${ticker} ---`);

        // 1. Find asset in DB
        const asset = await prisma.globalAsset.findFirst({
            where: { ticker, market: 'US' }
        });

        if (!asset) {
            console.log(`  ✗ Asset not found in database`);
            continue;
        }

        console.log(`  ✓ Found in DB: ${asset.name} (ID: ${asset.id})`);
        console.log(`    Current price: ${asset.lastPrice || 'NULL'}`);

        // 2. Fetch from Yahoo
        try {
            console.log(`  Fetching from Yahoo...`);
            const quote = await yahooFinance.quote(ticker);

            if (quote && quote.regularMarketPrice) {
                console.log(`  ✓ Yahoo returned: $${quote.regularMarketPrice} (${quote.currency})`);

                // 3. Update database
                console.log(`  Updating database...`);
                const updated = await prisma.globalAsset.update({
                    where: { id: asset.id },
                    data: {
                        lastPrice: quote.regularMarketPrice,
                        lastPriceDate: new Date()
                    }
                });

                console.log(`  ✓ Database updated successfully`);
                console.log(`    New price: $${updated.lastPrice}`);
                console.log(`    New date: ${updated.lastPriceDate?.toISOString()}`);
            } else {
                console.log(`  ✗ Yahoo returned no price`);
                console.log(`    Response:`, JSON.stringify(quote, null, 2).substring(0, 200));
            }
        } catch (e: any) {
            console.log(`  ✗ Error: ${e.message}`);
            console.log(`    Stack:`, e.stack?.substring(0, 300));
        }
    }

    // 4. Verify final state
    console.log('\n--- Final State ---');
    const finalAssets = await prisma.globalAsset.findMany({
        where: { ticker: { in: testTickers } },
        select: { ticker: true, lastPrice: true, lastPriceDate: true }
    });

    finalAssets.forEach(a => {
        console.log(`  ${a.ticker}: $${a.lastPrice || 'NULL'} (${a.lastPriceDate?.toLocaleDateString('es-AR') || '-'})`);
    });
}

main()
    .catch(e => {
        console.error('Fatal error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
