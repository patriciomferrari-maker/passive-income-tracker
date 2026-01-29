import { prisma } from '@/lib/prisma';

async function main() {
    const userEmail = 'pruebajuan@gmail.com';

    console.log('🗑️  Deleting MELI transactions...');
    console.log('');

    // 1. Find user
    const user = await prisma.user.findUnique({
        where: { email: userEmail }
    });

    if (!user) {
        console.log('❌ User not found');
        return;
    }

    // 2. Find MELI GlobalAsset
    const meliAsset = await prisma.globalAsset.findFirst({
        where: {
            ticker: 'MELI',
            market: 'ARG'
        }
    });

    if (!meliAsset) {
        console.log('❌ MELI GlobalAsset not found');
        return;
    }

    // 3. Find UserHolding
    const userHolding = await prisma.userHolding.findFirst({
        where: {
            userId: user.id,
            assetId: meliAsset.id
        },
        include: {
            transactions: true
        }
    });

    if (!userHolding) {
        console.log('❌ No UserHolding found for MELI');
        return;
    }

    console.log(`Found ${userHolding.transactions.length} transactions to delete`);
    console.log('');

    // 4. Delete transactions
    for (const tx of userHolding.transactions) {
        console.log(`Deleting transaction ${tx.id}...`);
        await prisma.globalAssetTransaction.delete({
            where: { id: tx.id }
        });
        console.log('✅ Deleted');
    }

    // 5. Delete UserHolding
    console.log('');
    console.log(`Deleting UserHolding ${userHolding.id}...`);
    await prisma.userHolding.delete({
        where: { id: userHolding.id }
    });
    console.log('✅ Deleted');

    console.log('');
    console.log('✅ All MELI data deleted successfully');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
