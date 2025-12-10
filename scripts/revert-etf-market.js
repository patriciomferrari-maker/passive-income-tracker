
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Reverting ETF Markets to US...');
    // Revert known US tickers to US market
    const usTickers = ['SPY', 'QQQ', 'ARKK', 'DIA', 'EEM', 'XLF', 'XLE', 'IWM'];
    // Use upper case for comparison if needed, but assuming exact match
    const count = await prisma.investment.updateMany({
        where: {
            ticker: { in: usTickers },
            type: 'ETF'
        },
        data: { market: 'US' }
    });
    console.log(`Reverted ${count.count} ETFs to US market.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
