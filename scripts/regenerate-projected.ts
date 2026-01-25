
import { prisma } from '../lib/prisma';
import { toArgNoon } from '../app/lib/date-utils';

async function main() {
    console.log('Starting regeneration of missing projected installments...');

    const plans = await prisma.barbosaInstallmentPlan.findMany({
        where: {
            // Only process if it has less transactions than quotas (rough check, we'll be more specific)
            // Actually, prisma filtering on relation count is tricky, let's fetch all active-ish ones
        },
        include: {
            transactions: true
        }
    });

    console.log(`Found ${plans.length} total plans. Checking for interruptions...`);

    for (const plan of plans) {
        const expectedCount = plan.installmentsCount;
        const currentCount = plan.transactions.length;

        // Tolerance: If current count >= expected, assume it's fine (or over-paid which is another issue)
        if (currentCount >= expectedCount) continue;

        console.log(`Plan [${plan.description}] (${plan.id}) has ${currentCount}/${expectedCount} transactions. Fixing...`);

        const startDate = new Date(plan.startDate);
        const amountPerQuota = plan.totalAmount / plan.installmentsCount; // Calculate average amount
        // Use amount from a real transaction if available for better precision?
        const realTx = plan.transactions.find(t => t.status === 'REAL');
        const finalAmount = realTx ? realTx.amount : amountPerQuota;

        const promises = [];

        // Check each slot
        for (let i = 0; i < expectedCount; i++) {
            // Target Date for this quota
            const targetDate = new Date(startDate);
            targetDate.setMonth(startDate.getMonth() + i);

            // Adjust day envelope (e.g. Jan 31 -> Feb 28)
            const originalDay = startDate.getDate();
            if (targetDate.getDate() !== originalDay) {
                targetDate.setDate(0);
            }

            // Check if we have a transaction matching this month/year
            // Tolerance: Same Month and Year
            const exists = plan.transactions.some(t => {
                const tDate = new Date(t.date);
                return tDate.getMonth() === targetDate.getMonth() &&
                    tDate.getFullYear() === targetDate.getFullYear();
            });

            if (!exists) {
                console.log(`   -> Missing Quota ${i + 1} (${targetDate.toISOString().split('T')[0]}). Creating...`);

                promises.push(prisma.barbosaTransaction.create({
                    data: {
                        userId: plan.userId,
                        date: targetDate,
                        amount: finalAmount,
                        currency: plan.currency,
                        type: 'EXPENSE',
                        description: `${plan.description} (Cuota ${i + 1}/${expectedCount})`,
                        categoryId: plan.categoryId,
                        subCategoryId: plan.subCategoryId,
                        status: 'PROJECTED',
                        isStatistical: false,
                        installmentPlanId: plan.id
                    }
                }));
            }
        }

        if (promises.length > 0) {
            await Promise.all(promises);
            console.log(`   -> Created ${promises.length} missing transactions.`);
        }
    }

    console.log('Regeneration complete.');
}

main();
