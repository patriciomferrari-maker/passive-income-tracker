
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Inspecting "Abono Racing" & "Cerini" ---');
    const user = await prisma.user.findUnique({ where: { email: 'patriciomferrari@gmail.com' } });
    if (!user) throw new Error('User not found');

    const plans = await prisma.barbosaInstallmentPlan.findMany({
        where: {
            userId: user.id,
            description: { in: ['Abono Racing', 'Cerini', 'abono racing', 'cerini'] },
            // mode: 'insensitive' // No mode in Prisma for 'in' usually, lets fetch all and filter if needed or rely on exact match first
        },
        include: { _count: { select: { transactions: true } } }
    });

    console.log(`Found ${plans.length} plans.`);
    plans.forEach(p => {
        console.log(`ID: ${p.id}`);
        console.log(`  Desc: "${p.description}" (Len: ${p.description.length})`);
        console.log(`  Amount: ${p.totalAmount}`);
        console.log(`  Tx Count: ${p._count.transactions}`);
        console.log(`  Created: ${p.createdAt.toISOString()}`);
        console.log('-----------------------------------');
    });
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
