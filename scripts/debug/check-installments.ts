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
        const isStatisticalCount = plan.transactions.filter(t => t.isStatistical).length;
        const nonStatisticalCount = plan.transactions.filter(t => !t.isStatistical).length;

        console.log(`Plan: ${plan.description}`);
        console.log(`  isStatistical Count: ${isStatisticalCount}`);
        console.log(`  Non-Statistical Count: ${nonStatisticalCount}`);
        if (nonStatisticalCount > 0) {
            console.log(`  Example non-statistical date: ${plan.transactions.find(t => !t.isStatistical)?.date}`);
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
