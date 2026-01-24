
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            category: true,
            transactions: true
        }
    });

    console.log("Last 5 Installment Plans:");
    plans.forEach(p => {
        console.log(`\nPlan: ${p.description}`);
        console.log(`Start Date (DB): ${p.startDate.toISOString()}`);
        console.log(`Installments: ${p.installmentsCount}`);
        console.log(`Transactions Linked: ${p.transactions.length}`);
        p.transactions.forEach((tx, i) => {
            console.log(`  Tx ${i + 1}: ${tx.description} | Date: ${tx.date.toISOString()} | Quota: ${tx.installmentNumber}`);
        });
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
