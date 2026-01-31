
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const targetEmail = process.argv[2];
    if (!targetEmail) {
        console.error("Provide target email");
        process.exit(1);
    }

    const sourceUser = await prisma.user.findUnique({ where: { email: 'admin@passiveincome.com' } });
    const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });

    if (!sourceUser || !targetUser) {
        console.error("Source or Target user not found.");
        process.exit(1);
    }

    console.log(`Transferring assets from ${sourceUser.email} -> ${targetUser.email}`);

    const updates = [
        prisma.property.updateMany({ where: { userId: sourceUser.id }, data: { userId: targetUser.id } }),
        prisma.investment.updateMany({ where: { userId: sourceUser.id }, data: { userId: targetUser.id } }),
        prisma.debt.updateMany({ where: { userId: sourceUser.id }, data: { userId: targetUser.id } }),
        prisma.bankOperation.updateMany({ where: { userId: sourceUser.id }, data: { userId: targetUser.id } }),
        prisma.costaCategory.updateMany({ where: { userId: sourceUser.id }, data: { userId: targetUser.id } }),
        // CostaTx and Notes are already done or optional, but let's be safe
        prisma.costaTransaction.updateMany({ where: { userId: sourceUser.id }, data: { userId: targetUser.id } }),
    ];

    const results = await Promise.all(updates);
    console.log("Transfer Complete!");
    console.log(`Moves: Prop=${results[0].count}, Inv=${results[1].count}, Debt=${results[2].count}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
