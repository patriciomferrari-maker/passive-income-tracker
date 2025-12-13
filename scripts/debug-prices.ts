
import { prisma } from '../lib/prisma';
import { getLatestPrices } from '../app/lib/market-data';

async function main() {
    const investments = await prisma.investment.findMany({
        where: { type: 'ON' },
        include: { transactions: true }
    });

    console.log(`Found ${investments.length} ON investments.`);

    const tickers = investments.map(i => i.ticker);
    const prices = await getLatestPrices(tickers);

    console.log('--- Prices Retrieved ---');
    prices.forEach(p => {
        console.log(`Ticker: ${p.ticker}, Price: ${p.price}, Currency: ${p.currency}`);
    });

    console.log('--- Investments ---');
    investments.forEach(inv => {
        console.log(`Ticker: ${inv.ticker}, DB Currency: ${inv.currency}`);
    });

    // Check economic indicator
    const usdRate = await prisma.economicIndicator.findFirst({
        where: { type: 'USD_BLUE' },
        orderBy: { date: 'desc' }
    });
    console.log('--- Exchange Rate ---');
    console.log(`USD Blue: ${usdRate?.value}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
