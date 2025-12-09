
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Treasury Transactions...');

    // Fetch treasuries with their transaction counts
    const investments = await prisma.investment.findMany({
        where: { type: 'TREASURY' },
        include: {
            user: true,
            transactions: true,
            _count: {
                select: { transactions: true }
            }
        }
    });

    console.log(`Found ${investments.length} Treasuries.`);
    investments.forEach(i => {
        console.log(`[${i.ticker}] ID: ${i.id}`);
        console.log(`  User: ${i.user.email}`);
        console.log(`  Transactions Count: ${i._count.transactions}`);
        i.transactions.forEach(t => {
            console.log(`    - ${t.date.toISOString()} | ${t.type} | ${t.totalAmount}`);
        });
        if (i.transactions.length === 0) {
            console.log('  -> This treasury will be HIDDEN from Dashboard due to "some: { type: BUY }" filter.');
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
