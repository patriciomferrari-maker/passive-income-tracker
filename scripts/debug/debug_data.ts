
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const startOfNextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

    console.log(`Range: ${startOfMonth.toISOString()} to ${startOfNextMonth.toISOString()}`);

    // ALL RATES
    const allRates = await prisma.economicIndicator.findMany({
        where: {
            type: 'TC_USD_ARS',
            date: { gte: startOfMonth }
        },
        orderBy: { date: 'asc' }
    });
    console.log('--- ALL RATES ---');
    allRates.forEach((r: any) => console.log(`${r.date.toISOString()} - ${r.value} (ID: ${r.id})`));

    // Picked Rate
    const blueIndicator = allRates[0]; // Logic used in Dashboard/Cashflow (first one ASC)
    const costaExchangeRate = blueIndicator?.value || 1160;

    console.log(`PICKED RATE: ${costaExchangeRate}`);

    // Transactions
    const costaTransactions = await prisma.costaTransaction.findMany({
        where: {
            type: 'EXPENSE',
            date: {
                gte: startOfMonth,
                lt: startOfNextMonth
            }
        }
    });

    let totalARS = 0;
    costaTransactions.forEach((t: any) => {
        totalARS += t.amount;
    });

    console.log(`Total ARS: ${totalARS}`);
    console.log(`Calculated USD: ${totalARS / costaExchangeRate}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
