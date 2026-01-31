
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userEmail = 'patriciomferrari@gmail.com';
    console.log(`Finding user ${userEmail}...`);
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
        console.error('User not found!');
        return;
    }
    console.log(`User ID: ${user.id}`);

    const ticker = 'TEST_STOCK_' + Date.now();
    console.log(`Attempting to create STOCK ${ticker}...`);

    try {
        const inv = await prisma.investment.create({
            data: {
                userId: user.id,
                ticker: ticker,
                name: 'Test Stock Creation',
                type: 'STOCK',
                market: 'US',
                currency: 'USD',
                emissionDate: null,
                couponRate: null,
                frequency: null,
                maturityDate: null,
                amortization: null
            }
        });
        console.log('Success! Investment created:', inv);

        // Clean up
        await prisma.investment.delete({ where: { id: inv.id } });
        console.log('Cleaned up test investment.');

    } catch (e) {
        console.error('FAILED to create investment:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
