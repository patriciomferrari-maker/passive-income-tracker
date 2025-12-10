
import { prisma } from '../lib/prisma';
import yahooFinance from 'yahoo-finance2';

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
            const quote = await yahooFinance.quote(spy.ticker) as any;
            console.log('Yahoo Quote Result:', quote);
        } catch (e: any) {
            console.error('Yahoo Fetch Error:', e.message);
            console.error(e);
        }
    } else {
        console.log('SPY not found in DB!');
    }
}

main().catch(console.error);
