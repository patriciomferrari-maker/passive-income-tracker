const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTreasuries() {
    console.log('Checking for Treasuries in ARG market...');
    const leaking = await prisma.investment.findMany({
        where: {
            type: 'TREASURY',
            market: 'ARG'
        }
    });

    if (leaking.length > 0) {
        console.log('FOUND LEAKING TREASURIES:', leaking.map(t => `${t.ticker} (${t.id})`));
        // Fix them if requested? Or just report. User asked to fix.
        // I will fix them here.
        console.log('Fixing leaking Treasuries to market=US...');
        await prisma.investment.updateMany({
            where: {
                type: 'TREASURY',
                market: 'ARG'
            },
            data: { market: 'US' }
        });
        console.log('Fixed.');
    } else {
        console.log('No leaking Treasuries found.');
    }
}

checkTreasuries()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
