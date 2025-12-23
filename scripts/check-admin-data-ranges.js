const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllDataRanges() {
    try {
        console.log('\n=== ADMIN DATA RANGES REPORT ===\n');

        // 1. IPC (Inflación)
        const ipcData = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' },
            select: { date: true }
        });
        if (ipcData.length > 0) {
            console.log('📊 IPC (Inflación):');
            console.log(`   Desde: ${ipcData[0].date.toISOString().slice(0, 10)}`);
            console.log(`   Hasta: ${ipcData[ipcData.length - 1].date.toISOString().slice(0, 10)}`);
            console.log(`   Total: ${ipcData.length} registros\n`);
        }

        // 2. TC Blue (Dólar Blue)
        const tcBlueData = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_BLUE' },
            orderBy: { date: 'asc' },
            select: { date: true }
        });
        if (tcBlueData.length > 0) {
            console.log('💵 TC Blue (Dólar Blue):');
            console.log(`   Desde: ${tcBlueData[0].date.toISOString().slice(0, 10)}`);
            console.log(`   Hasta: ${tcBlueData[tcBlueData.length - 1].date.toISOString().slice(0, 10)}`);
            console.log(`   Total: ${tcBlueData.length} registros\n`);
        }

        // 3. TC Oficial
        const tcOficialData = await prisma.economicIndicator.findMany({
            where: { type: 'TC_OFICIAL' },
            orderBy: { date: 'asc' },
            select: { date: true }
        });
        if (tcOficialData.length > 0) {
            console.log('🏦 TC Oficial:');
            console.log(`   Desde: ${tcOficialData[0].date.toISOString().slice(0, 10)}`);
            console.log(`   Hasta: ${tcOficialData[tcOficialData.length - 1].date.toISOString().slice(0, 10)}`);
            console.log(`   Total: ${tcOficialData.length} registros\n`);
        }

        // 4. UVA
        const uvaData = await prisma.economicIndicator.findMany({
            where: { type: 'UVA' },
            orderBy: { date: 'asc' },
            select: { date: true }
        });
        if (uvaData.length > 0) {
            console.log('🏠 UVA:');
            console.log(`   Desde: ${uvaData[0].date.toISOString().slice(0, 10)}`);
            console.log(`   Hasta: ${uvaData[uvaData.length - 1].date.toISOString().slice(0, 10)}`);
            console.log(`   Total: ${uvaData.length} registros\n`);
        }

        // 5. Asset Prices (ONs/ETFs)
        const assetPrices = await prisma.assetPrice.findMany({
            orderBy: { date: 'asc' },
            select: { date: true, investment: { select: { ticker: true } } },
            distinct: ['investmentId']
        });
        if (assetPrices.length > 0) {
            console.log('📈 Asset Prices (ONs/ETFs):');
            const allPrices = await prisma.assetPrice.findMany({
                orderBy: { date: 'asc' },
                select: { date: true }
            });
            console.log(`   Desde: ${allPrices[0].date.toISOString().slice(0, 10)}`);
            console.log(`   Hasta: ${allPrices[allPrices.length - 1].date.toISOString().slice(0, 10)}`);
            console.log(`   Total: ${allPrices.length} registros\n`);
        }

        // 6. Check which tickers have prices
        const investments = await prisma.investment.findMany({
            where: {
                assetPrices: {
                    some: {}
                }
            },
            select: {
                ticker: true,
                type: true,
                _count: {
                    select: { assetPrices: true }
                }
            }
        });
        if (investments.length > 0) {
            console.log('💼 Tickers con precios:');
            investments.forEach(inv => {
                console.log(`   ${inv.ticker} (${inv.type}): ${inv._count.assetPrices} precios`);
            });
            console.log('');
        }

        console.log('=================================\n');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAllDataRanges();
