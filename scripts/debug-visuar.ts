
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Inspecting VISUAR SA Plan...');
    const plan = await prisma.barbosaInstallmentPlan.findFirst({
        where: { description: { contains: 'VISUAR' } },
        include: {
            transactions: {
                orderBy: { date: 'asc' }
            }
        }
    });

    if (!plan) {
        console.log('Plan not found');
        return;
    }

    console.log(`Plan ID: ${plan.id}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Start Date: ${plan.startDate}`);
    console.log(`Installments: ${plan.installmentsCount}`);
    console.log(`Total Amount: ${plan.totalAmount}`);
    console.log('--- Transactions ---');
    plan.transactions.forEach(t => {
        console.log(`[${t.status}] ${t.date.toISOString().split('T')[0]} - ${t.amount} - ${t.description}`);
    });
}

main();
