
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Cleaning Up Orphaned Plans (0 Transactions) ---');

    // Find all plans for Paato
    const user = await prisma.user.findUnique({ where: { email: 'paato.ferrari@hotmail.com' } });
    if (!user) throw new Error('User not found');

    const plans = await prisma.barbosaInstallmentPlan.findMany({
        where: { userId: user.id },
        include: { _count: { select: { transactions: true } } }
    });

    let deleted = 0;
    for (const p of plans) {
        if (p._count.transactions === 0) {
            console.log(`Deleting Invoice WITH NO TXS: ${p.description} ($${p.totalAmount}) - ID: ${p.id}`);
            await prisma.barbosaInstallmentPlan.delete({ where: { id: p.id } });
            deleted++;
        }
    }

    console.log(`Deleted ${deleted} orphaned plans.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
