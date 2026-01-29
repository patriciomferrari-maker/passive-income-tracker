
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectInvestments() {
    const tickers = ['S&P500', 'AMZN', 'SPY', 'X', 'AAPL', 'JNJ', 'MSFT', 'JPM'];
    console.log('--- Inspecting Investments ---');
    const investments = await prisma.investment.findMany({
        where: { ticker: { in: tickers } }
    });

    investments.forEach(i => {
        console.log(`- ID: ${i.id}, Ticker: ${i.ticker}, Name: ${i.name}, Type: ${i.type}, Market: ${i.market}, Currency: ${i.currency}`);
    });
}

inspectInvestments()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
