import { prisma } from '../lib/prisma';
import yahooFinance from 'yahoo-finance2';

async function main() {
    console.log('=== Diagnóstico de Actualización de Precios ===\n');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Test con solo 5 ETFs para diagnóstico rápido
    const testTickers = ['SPY', 'QQQ', 'VOO', 'VTI', 'IVV'];

    console.log('1. Verificando ETFs en base de datos...');
    for (const ticker of testTickers) {
        const asset = await prisma.globalAsset.findFirst({
            where: { ticker, market: 'US' }
        });

        if (asset) {
            console.log(`  ✓ ${ticker}: Encontrado (ID: ${asset.id.substring(0, 8)}..., Precio actual: ${asset.lastPrice || 'NULL'})`);
        } else {
            console.log(`  ✗ ${ticker}: NO ENCONTRADO en base de datos`);
        }
    }

    console.log('\n2. Probando Yahoo Finance API...');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < testTickers.length; i++) {
        const ticker = testTickers[i];

        if (i > 0) {
            console.log(`   Esperando 3 segundos...`);
            await delay(3000);
        }

        try {
            console.log(`   Consultando ${ticker}...`);
            const quote = await yahooFinance.quote(ticker);

            if (quote && quote.regularMarketPrice) {
                console.log(`   ✓ ${ticker}: $${quote.regularMarketPrice}`);
                successCount++;

                // Intentar actualizar en DB
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
                    console.log(`     → Base de datos actualizada`);
                }
            } else {
                console.log(`   ✗ ${ticker}: Yahoo no devolvió precio`);
                failCount++;
            }
        } catch (e: any) {
            console.log(`   ✗ ${ticker}: ERROR - ${e.message}`);
            failCount++;
        }
    }

    console.log(`\n3. Resumen:`);
    console.log(`   Exitosos: ${successCount}/${testTickers.length}`);
    console.log(`   Fallidos: ${failCount}/${testTickers.length}`);

    console.log('\n4. Verificación final en base de datos:');
    const finalAssets = await prisma.globalAsset.findMany({
        where: { ticker: { in: testTickers } },
        select: { ticker: true, lastPrice: true, lastPriceDate: true },
        orderBy: { ticker: 'asc' }
    });

    finalAssets.forEach(a => {
        const price = a.lastPrice ? `$${Number(a.lastPrice).toFixed(2)}` : 'NULL';
        const date = a.lastPriceDate ? a.lastPriceDate.toLocaleString('es-AR') : '-';
        console.log(`   ${a.ticker.padEnd(6)} ${price.padStart(10)} (${date})`);
    });
}

main()
    .catch(e => {
        console.error('\n❌ Error fatal:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
