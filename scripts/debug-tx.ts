
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const txs = await prisma.barbosaTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        where: {
            description: { contains: 'VISUAR' }
        },
        include: {
            installmentPlan: true
        }
    });

    console.log("Searching for 'VISUAR' transactions:");
    if (txs.length === 0) {
        console.log("No transactions found.");
    } else {
        txs.forEach(tx => {
            console.log(`\nTx: ${tx.description}`);
            console.log(`Date: ${tx.date.toISOString()}`);
            console.log(`Amount: ${tx.amount}`);
            console.log(`Installment Plan ID: ${tx.installmentPlanId}`);
            if (tx.installmentPlan) {
                console.log(`  -> Plan Start Date: ${tx.installmentPlan.startDate.toISOString()}`);
                console.log(`  -> Plan Installments: ${tx.installmentPlan.installmentsCount}`);
            } else {
                console.log("  -> NO PLAN LINKED");
            }
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
