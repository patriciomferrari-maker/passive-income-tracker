
import { PrismaClient } from '@prisma/client';
import yahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnosing SPY ---');

    console.log('1. Checking DB for SPY...');
    const spy = await prisma.investment.findFirst({
        where: { ticker: { contains: 'SPY' } }
    });
    console.log('SPY in DB:', spy);

    if (spy) {
        console.log('\n2. Testing Yahoo Finance Fetch for:', spy.ticker);
        try {
            // Force strict strict validation off to see raw result
            const quote = await yahooFinance.quote(spy.ticker, { validateResult: false }) as any;

            console.log('Yahoo Quote Result (Raw):');
            console.log('Symbol:', quote.symbol);
            console.log('Regular Market Price:', quote.regularMarketPrice);
            console.log('Currency:', quote.currency);
            console.log('Full Quote Keys:', Object.keys(quote));

        } catch (e: any) {
            console.error('Yahoo Fetch Error:', e.message);
            console.error(e);
        }
    } else {
        console.log('SPY not found in DB!');
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
