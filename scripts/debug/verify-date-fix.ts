import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = (await prisma.user.findFirst())?.id;
    if (!userId) throw new Error('No user found');

    // Input string from frontend (e.g., 2026-06-12)
    const inputStartDate = '2026-06-12';

    console.log('--- Testing Create Plan ---');
    console.log(`Input Date String: ${inputStartDate}`);

    // Simulate Logic in API (Create)
    const [y, m, d] = inputStartDate.split('-').map(Number);
    const createdDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    console.log(`Generated UTC Date (should be 12:00): ${createdDate.toISOString()}`);

    const plan = await prisma.barbosaInstallmentPlan.create({
        data: {
            userId,
            description: 'TEST DATE FIX',
            totalAmount: 12000,
            installmentsCount: 3,
            startDate: createdDate,
            currency: 'ARS',
            categoryId: (await prisma.barbosaCategory.findFirst())?.id || 'dummy',
        }
    });

    // Verify stored plan date
    const storedPlan = await prisma.barbosaInstallmentPlan.findUnique({ where: { id: plan.id } });
    console.log(`Stored Plan StartDate: ${storedPlan?.startDate.toISOString()} (Compare to input)`);

    // Verify Transactions
    // Simulate Loop Logic
    for (let i = 0; i < 3; i++) {
        const monthIndex = m - 1 + i;
        // Re-calc year/month to simulate loop
        const ty = y + Math.floor(monthIndex / 12);
        const tm = monthIndex % 12;

        const txDate = new Date(Date.UTC(ty, tm, d, 12, 0, 0));

        await prisma.barbosaTransaction.create({
            data: {
                userId,
                installmentPlanId: plan.id,
                date: txDate,
                amount: 4000,
                description: `Quota ${i + 1}`,
                categoryId: plan.categoryId,
                type: 'EXPENSE',
                status: 'PROJECTED'
            }
        });
    }

    const txs = await prisma.barbosaTransaction.findMany({
        where: { installmentPlanId: plan.id },
        orderBy: { date: 'asc' }
    });

    console.log('--- Stored Transactions ---');
    txs.forEach(t => {
        console.log(`Tx ${t.description}: ${t.date.toISOString()} -> GMT-3 would be: ${new Date(t.date.getTime() - 3 * 3600000).toISOString()}`);
    });

    // Cleanup
    await prisma.barbosaTransaction.deleteMany({ where: { installmentPlanId: plan.id } });
    await prisma.barbosaInstallmentPlan.delete({ where: { id: plan.id } });
}

main().catch(console.error).finally(() => prisma.$disconnect());
