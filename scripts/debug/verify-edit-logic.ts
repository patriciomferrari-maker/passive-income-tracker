import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // 1. Setup: Create a test plan with 3 installments
    // Start Date: 2024-01-01. Amount $1000.
    // Tx 1: REAL (Paid). Date: 2024-01-05 (Manual Override originally?).
    // Tx 2: PROJECTED.
    // Tx 3: PROJECTED.

    const userId = (await prisma.user.findFirst())?.id;
    if (!userId) throw new Error('No user found');

    const plan = await prisma.barbosaInstallmentPlan.create({
        data: {
            userId,
            description: 'TEST PLAN EDIT',
            totalAmount: 3000,
            installmentsCount: 3,
            startDate: new Date('2024-01-01'),
            currency: 'USD',
            categoryId: (await prisma.barbosaCategory.findFirst())?.id || 'dummy',
        }
    });

    // Create transactions
    await prisma.barbosaTransaction.create({
        data: {
            userId,
            installmentPlanId: plan.id,
            description: 'TEST PLAN EDIT (1/3)',
            amount: 1000,
            date: new Date('2024-01-05'), // Note: 5th
            status: 'REAL', // PAID
            type: 'EXPENSE',
            categoryId: plan.categoryId,
            currency: 'USD'
        }
    });

    await prisma.barbosaTransaction.create({
        data: {
            userId,
            installmentPlanId: plan.id,
            description: 'TEST PLAN EDIT (2/3)',
            amount: 1000,
            date: new Date('2024-02-01'),
            status: 'PROJECTED',
            type: 'EXPENSE',
            categoryId: plan.categoryId,
            currency: 'USD'
        }
    });

    await prisma.barbosaTransaction.create({
        data: {
            userId,
            installmentPlanId: plan.id,
            description: 'TEST PLAN EDIT (3/3)',
            amount: 1000,
            date: new Date('2024-03-01'),
            status: 'PROJECTED',
            type: 'EXPENSE',
            categoryId: plan.categoryId,
            currency: 'USD'
        }
    });

    console.log('Initial State Created. ID:', plan.id);

    // 2. Simulate EDIT Logic
    // Change Total to $6000 ($2000 each).
    // Change Date to '2024-02-01' (Shift 1 month).
    // Change Count to 4.

    const newTotal = 6000;
    const newCount = 4;
    const newStart = new Date('2024-02-01');

    // --- LOGIC COPY START ---
    await prisma.$transaction(async (tx) => {
        // Fetch existing sorted
        const existingTxs = await tx.barbosaTransaction.findMany({
            where: { installmentPlanId: plan.id },
            orderBy: { date: 'asc' }
        });

        const amountPer = newTotal / newCount; // 1500

        for (let i = 0; i < newCount; i++) {
            const targetDate = new Date(newStart);
            targetDate.setMonth(newStart.getMonth() + i);

            // Day clamping simplified for test
            const desc = `TEST PLAN EDIT (${i + 1}/${newCount})`;

            if (i < existingTxs.length) {
                // Update
                const t = existingTxs[i];
                console.log(`Updating Tx ${t.id} (${t.status}). Old Date: ${t.date.toISOString().split('T')[0]}. New Date: ${targetDate.toISOString().split('T')[0]}`);
                await tx.barbosaTransaction.update({
                    where: { id: t.id },
                    data: {
                        date: targetDate, // 1st loop: Feb, 2nd: Mar
                        amount: amountPer, // 1500
                        description: desc,
                        // Not changing status
                    }
                });
            } else {
                // Create
                console.log(`Creating New Tx (${i + 1}). Date: ${targetDate.toISOString().split('T')[0]}`);
                await tx.barbosaTransaction.create({
                    data: {
                        userId: plan.userId,
                        installmentPlanId: plan.id,
                        date: targetDate,
                        amount: amountPer,
                        description: desc,
                        type: 'EXPENSE',
                        status: 'PROJECTED',
                        currency: 'USD',
                        categoryId: plan.categoryId
                    }
                });
            }
        }

        // Delete excess? (None in this case, 3 -> 4)
    });
    // --- LOGIC COPY END ---

    // 3. Verify Results
    const finalTxs = await prisma.barbosaTransaction.findMany({
        where: { installmentPlanId: plan.id },
        orderBy: { date: 'asc' }
    });

    console.log('--- Final State ---');
    finalTxs.forEach(t => {
        console.log(`${t.description} | ${t.date.toISOString().split('T')[0]} | $${t.amount} | ${t.status}`);
    });

    // Cleanup
    console.log('Cleaning up...');
    await prisma.barbosaTransaction.deleteMany({ where: { installmentPlanId: plan.id } });
    await prisma.barbosaInstallmentPlan.delete({ where: { id: plan.id } });
}

main().catch(console.error).finally(() => prisma.$disconnect());
