
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking Transaction Currencies...");
    const distinctCurrencies = await prisma.transaction.groupBy({
        by: ['currency'],
        _count: {
            currency: true
        }
    });
    console.log("Currencies found:", distinctCurrencies);

    console.log("\nChecking Economic Indicators (Exchange Rates)...");
    const rates = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' },
        take: 5
    });
    console.log("Latest rates:", rates);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
