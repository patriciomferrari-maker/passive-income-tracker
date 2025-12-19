
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

    console.log(`Checking Range: ${start.toISOString()} to ${end.toISOString()}`);

    // 1. Fetch Transactions
    const costaTx = await prisma.costaTransaction.findMany({
        where: {
            type: 'EXPENSE',
            date: { gte: start, lt: end }
        }
    });

    console.log(`Found ${costaTx.length} transactions.`);

    // 2. Fetch Rates (TC_dollar_blue which seems to be used implicitly or TC_dollar_mep?)
    // CashflowTab fetches /api/economic-data/tc
    // Let's see what is in EconomicIndicator
    const rates = await prisma.economicIndicator.findMany({
        where: { type: { in: ['TC_dollar_blue', 'TC_dollar_mep'] } },
        orderBy: { date: 'desc' },
        take: 20
    });

    console.log('--- RATES ---');
    rates.forEach((r: any) => console.log(`${r.type} ${r.date.toISOString().split('T')[0]}: ${r.value}`));

    console.log('--- TRANSACTIONS ---');
    let totalARS = 0;
    let totalUSD_Calculated = 0; // Using Rate

    // Use a heuristic rate if not found, e.g. 1434 derived from screenshot
    const heuristicRate = 1434;
    const dashboardRate = 1160;

    costaTx.forEach((t: any) => {
        console.log(`${t.date.toISOString().split('T')[0]} - ${t.description}: ${t.amount} ${t.currency}`);
        totalARS += t.amount; // Assuming ARS for simulation
    });

    console.log(`Total Nominal (ARS?): ${totalARS}`);
    console.log(`At Rate ${heuristicRate}: ${totalARS / heuristicRate}`);
    console.log(`At Rate ${dashboardRate}: ${totalARS / dashboardRate}`);

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
