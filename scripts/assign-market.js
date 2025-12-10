const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Market Assignment Migration...');

    // 1. Set ARG for ON, CEDEAR, CORPORATE_BOND
    const argResult = await prisma.investment.updateMany({
        where: {
            type: { in: ['ON', 'CEDEAR', 'CORPORATE_BOND'] }
        },
        data: {
            market: 'ARG'
        }
    });
    console.log(`Updated ${argResult.count} investments to market: ARG`);

    // 2. Set US for TREASURY
    const usResult = await prisma.investment.updateMany({
        where: {
            type: { in: ['TREASURY'] }
        },
        data: {
            market: 'US'
        }
    });
    console.log(`Updated ${usResult.count} investments to market: US`);

    // 3. Set US for ETF (Assuming all current ETFs are US based on user report)
    // If user wants specific ETFs to be ARG, they might need to change type to CEDEAR or we add UI switch.
    const etfResult = await prisma.investment.updateMany({
        where: {
            type: 'ETF'
        },
        data: {
            market: 'US'
        }
    });
    console.log(`Updated ${etfResult.count} ETF investments to market: US`);

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
