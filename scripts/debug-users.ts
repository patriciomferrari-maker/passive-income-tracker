import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ include: { _count: { select: { barbosaTransactions: true } } } });
    console.log('--- Users ---');
    users.forEach(u => {
        console.log(`ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Txs: ${u._count.barbosaTransactions}`);
    });

    if (users.length > 0) {
        const u = users[0];
        console.log(`\n--- Sampling User ${u.email} ---`);

        const startDate = new Date('2025-11-01T00:00:00');
        const endDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), 0, 23, 59, 59);
        console.log(`Query Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        const txs = await prisma.barbosaTransaction.findMany({
            where: {
                userId: u.id,
                date: { gte: startDate, lte: endDate }
            }
        });
        console.log(`Found ${txs.length} transactions in range.`);
        if (txs.length > 0) {
            console.log(`First Tx Date: ${txs[0].date.toISOString()}`);
            console.log(`Last Tx Date: ${txs[txs.length - 1].date.toISOString()}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
