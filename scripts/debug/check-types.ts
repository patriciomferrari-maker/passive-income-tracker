
import { prisma } from '../lib/prisma.ts';

async function checkTransactionTypes() {
    try {
        console.log('Fetching last 20 transactions...');
        const transactions = await prisma.transaction.findMany({
            take: 20,
            include: {
                investment: {
                    select: {
                        ticker: true,
                        type: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        console.log('--- Transactions Check ---');
        transactions.forEach(tx => {
            console.log(`[${tx.date.toISOString().split('T')[0]}] ${tx.investment.ticker} - Type: ${tx.investment.type}`);
        });

        const typeCounts = await prisma.investment.groupBy({
            by: ['type'],
            _count: true
        });
        console.log('--- Investment Type Counts ---');
        console.log(typeCounts);

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTransactionTypes();
