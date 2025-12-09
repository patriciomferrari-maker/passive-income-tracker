
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Treasury Cashflows...');

    const treasuries = await prisma.investment.findMany({
        where: { type: 'TREASURY' },
        include: {
            cashflows: true
        }
    });

    treasuries.forEach(t => {
        console.log(`[${t.ticker}] ${t.name}`);
        console.log(`  - Cashflows found: ${t.cashflows.length}`);
        if (t.cashflows.length > 0) {
            console.log(`  - First: ${t.cashflows[0].date.toISOString()} ${t.cashflows[0].amount}`);
        }
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
