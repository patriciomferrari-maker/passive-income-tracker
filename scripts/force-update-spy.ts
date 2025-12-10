import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const prisma = new PrismaClient();

async function main() {
    console.log('--- Force Updating SPY ---');

    console.log('1. Fetching SPY from Yahoo...');
    try {
        const quote = await yahooFinance.quote('SPY') as any;
        const price = quote.regularMarketPrice;
        const currency = quote.currency || 'USD';

        console.log(`Got Price: ${price} ${currency}`);

        if (price) {
            console.log('2. Updating DB...');
            const update = await prisma.investment.updateMany({
                where: { ticker: 'SPY' },
                data: {
                    lastPrice: price,
                    lastPriceDate: new Date()
                }
            });
            console.log(`Updated ${update.count} records.`);
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
