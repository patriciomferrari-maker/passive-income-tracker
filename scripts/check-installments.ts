import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        include: {
            transactions: true
        }
    });

    console.log(`Found ${plans.length} plans.`);
    plans.forEach(plan => {
        const realTx = plan.transactions.filter(t => t.status === 'REAL');
        const projectedTx = plan.transactions.filter(t => t.status === 'PROJECTED');
        const futureReal = realTx.filter(t => t.date > new Date());

        console.log(`Plan: ${plan.description} (totalAmount: ${plan.totalAmount})`);
        console.log(`  Total installments: ${plan.installmentsCount}`);
        console.log(`  REAL count: ${realTx.length}`);
        console.log(`  PROJECTED count: ${projectedTx.length}`);
        console.log(`  Future REAL: ${futureReal.length}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
