
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const txs = await prisma.barbosaTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        where: {
            description: { contains: 'SOLODEPYURB' }
        },
        include: {
            installmentPlan: true
        }
    });

    console.log("Searching for 'SOLODEPYURB' transactions:");
    if (txs.length === 0) {
        console.log("No transactions found.");
    } else {
        txs.forEach(tx => {
            console.log(`\nTx: ${tx.description}`);
            console.log(`Date: ${tx.date.toISOString()}`);
            console.log(`Amount: ${tx.amount}`);
            console.log(`Credit Card ID: ${tx.creditCardId || 'None'}`);
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
