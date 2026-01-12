import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmixq96ww0000l8pp4w1zu2cy'; // Patricio
    console.log('User ID:', userId);

    // Logic from API
    const startDate = new Date('2025-11-01T00:00:00');
    const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), 0, 23, 59, 59);

    console.log(`Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch Transactions
    const txs = await prisma.barbosaTransaction.findMany({
        where: {
            userId,
            date: { gte: startDate, lte: endDate }
        },
        include: { category: true }
    });

    console.log(`Found ${txs.length} transactions.`);

    // Processing Simulation
    const bucketSums: any = {};

    txs.forEach(t => {
        // Key gen
        const key = `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}`;

        // Values
        const amount = t.amount;
        const rate = t.exchangeRate || (t.currency === 'ARS' ? 1150 : 1);
        const amountUSD = (t.currency === 'USD') ? amount : (rate > 0 ? amount / rate : 0);

        const isStatistical = t.isStatistical;

        if (!bucketSums[key]) bucketSums[key] = { count: 0, sumUSD: 0, ignoredStatistical: 0 };

        // UPDATED FILTER LOGIC:
        if (!isStatistical || t.status === 'PROJECTED') {
            bucketSums[key].count++;
            bucketSums[key].sumUSD += amountUSD;
        } else {
            bucketSums[key].ignoredStatistical++;
        }
    });

    console.log('--- Transactions Buckets (With Filter Fix) ---');
    console.table(bucketSums);
}

main().catch(console.error).finally(() => prisma.$disconnect());
