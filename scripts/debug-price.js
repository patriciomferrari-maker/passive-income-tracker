
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const ticker = 'DNC5D';
        console.log(`Searching for investment with ticker: ${ticker}`);

        const investment = await prisma.investment.findFirst({
            where: { ticker: ticker },
            include: { transactions: true }
        });

        if (!investment) {
            console.log('Investment not found');
            return;
        }

        console.log('--- Investment Data ---');
        console.log(`ID: ${investment.id}`);
        console.log(`Ticker: ${investment.ticker}`);
        console.log(`Currency: ${investment.currency}`);
        console.log(`Last Price: ${investment.lastPrice}`);
        console.log(`Type: ${investment.type}`);

        console.log('\n--- Recent Asset Prices (Last 7 Days) ---');
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const prices = await prisma.assetPrice.findMany({
            where: { investmentId: investment.id, date: { gte: weekAgo } },
            orderBy: { date: 'desc' }
        });

        prices.forEach(p => {
            console.log(`Date: ${p.date.toISOString().split('T')[0]}, Price: ${p.price}`);
        });

        if (prices.length === 0) console.log('No recent asset prices found.');

        console.log('\n--- Transactions ---');
        investment.transactions.forEach(t => {
            console.log(`Date: ${t.date.toISOString().split('T')[0]}, Type: ${t.type}, Qty: ${t.quantity}, Price: ${t.price}, Total: ${t.totalAmount}, Currency: ${t.currency}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
