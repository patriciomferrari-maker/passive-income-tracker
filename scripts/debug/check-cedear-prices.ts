
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCedears() {
    console.log('--- Checking PROBLEMATIC CEDEARs in GlobalAsset ---');
    const globalCedears = await prisma.globalAsset.findMany({
        where: {
            type: 'CEDEAR',
            OR: [
                { lastPrice: null },
                { lastPrice: { equals: 0 } }
            ]
        }
    });

    globalCedears.forEach(a => {
        console.log(`[Global] ${a.ticker}: ${a.lastPrice} (${a.lastPriceDate})`);
    });

    console.log('\n--- Checking PROBLEMATIC CEDEARs in Investment ---');
    const investmentCedears = await prisma.investment.findMany({
        where: {
            type: 'CEDEAR',
            OR: [
                { lastPrice: null },
                { lastPrice: { equals: 0 } }
            ]
        }
    });

    investmentCedears.forEach(i => {
        console.log(`[Investment] ${i.ticker}: ${i.lastPrice} (${i.lastPriceDate})`);
    });

    console.log('\n--- Checking AssetPrice history for ALL CEDEARs (Last Entry if missing/zero) ---');
    const allInvestments = await prisma.investment.findMany({ where: { type: 'CEDEAR' } });
    for (const i of allInvestments) {
        const lastPrice = await prisma.assetPrice.findFirst({
            where: { investmentId: i.id },
            orderBy: { date: 'desc' }
        });
        if (!lastPrice || lastPrice.price === 0) {
            console.log(`[Problem History] ${i.ticker}: NO HISTORY or ZERO price in assetPrice table`);
        }
    }
}

checkCedears()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
