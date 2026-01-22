import { prisma } from '../lib/prisma';
import yahooFinance from 'yahoo-finance2';

async function main() {
    console.log('=== Test con Delay de 5 Segundos ===\n');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Test con 3 ETFs
    const testTickers = ['SPY', 'QQQ', 'VOO'];

    let successCount = 0;

    for (let i = 0; i < testTickers.length; i++) {
        const ticker = testTickers[i];

        if (i > 0) {
            console.log(`Esperando 5 segundos...`);
            await delay(5000);
        }

        try {
            console.log(`Consultando ${ticker}...`);
            const quote = await yahooFinance.quote(ticker);

            if (quote && quote.regularMarketPrice) {
                console.log(`✓ ${ticker}: $${quote.regularMarketPrice}`);
                successCount++;

                // Actualizar DB
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
                    console.log(`  → DB actualizada\n`);
                }
            } else {
                console.log(`✗ ${ticker}: Sin precio\n`);
            }
        } catch (e: any) {
            console.log(`✗ ${ticker}: ${e.message}\n`);
        }
    }

    console.log(`\n=== Resultado: ${successCount}/${testTickers.length} exitosos ===\n`);

    // Verificar
    const assets = await prisma.globalAsset.findMany({
        where: { ticker: { in: testTickers } },
        select: { ticker: true, lastPrice: true, lastPriceDate: true }
    });

    console.log('Estado en DB:');
    assets.forEach(a => {
        console.log(`  ${a.ticker}: $${a.lastPrice || 'NULL'} (${a.lastPriceDate?.toLocaleString('es-AR') || '-'})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
