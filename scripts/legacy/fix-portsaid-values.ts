import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const plan = await prisma.barbosaInstallmentPlan.findFirst({
        where: {
            description: { contains: 'Portsaid', mode: 'insensitive' },
            totalAmount: 59799.99
        },
        include: { transactions: true }
    });

    if (!plan) {
        console.log('Portsaid plan with totalAmount 59799.99 not found.');
        return;
    }

    console.log(`Found Plan: ${plan.description}, Total: ${plan.totalAmount}`);

    const correctAmountPerQuota = plan.totalAmount / plan.installmentsCount; // ~19933.33
    console.log(`Correct Amount Per Quota should be: ${correctAmountPerQuota}`);

    for (const tx of plan.transactions) {
        if (tx.amount > 100000) { // It is ~199k currently
            console.log(`Fixing tx ${tx.id} (${tx.description}): ${tx.amount} -> ${correctAmountPerQuota}`);
            await prisma.barbosaTransaction.update({
                where: { id: tx.id },
                data: {
                    amount: correctAmountPerQuota,
                    amountUSD: tx.currency === 'USD' ? correctAmountPerQuota : null // Assuming USD is same if it was USD, but it is ARS likely
                }
            });
        } else {
            console.log(`Tx ${tx.id} seems correct: ${tx.amount}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
