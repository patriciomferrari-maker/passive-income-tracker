
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const usGlobalAssets = await prisma.globalAsset.count({
            where: { market: 'US' }
        });

        const usInvestments = await prisma.investment.count({
            where: {
                type: { in: ['ETF', 'STOCK', 'TREASURY'] },
                currency: 'USD' // Assuming US assets are in USD
            }
        });

        console.log(`US Global Assets: ${usGlobalAssets}`);
        console.log(`US Investments (likely US market): ${usInvestments}`);
        console.log(`Total US Assets to track: ${usGlobalAssets + usInvestments}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
