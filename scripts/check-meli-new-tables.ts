import { prisma } from '@/lib/prisma';

async function main() {
    const userEmail = 'pruebajuan@gmail.com';

    console.log('🔍 Checking UserHolding and GlobalAssetTransaction for MELI...');
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

    console.log('✅ MELI GlobalAsset ID:', meliAsset.id);
    console.log('');

    // 3. Check UserHolding
    const userHolding = await prisma.userHolding.findFirst({
        where: {
            userId: user.id,
            assetId: meliAsset.id
        },
        include: {
            transactions: true
        }
    });

    if (userHolding) {
        console.log('✅ UserHolding found:');
        console.log('   ID:', userHolding.id);
        console.log('   Transactions:', userHolding.transactions.length);
        console.log('');

        if (userHolding.transactions.length > 0) {
            console.log('📊 GlobalAssetTransactions:');
            userHolding.transactions.forEach((tx, idx) => {
                console.log(`   ${idx + 1}. ID: ${tx.id}`);
                console.log(`      Date: ${tx.date.toISOString().split('T')[0]}`);
                console.log(`      Type: ${tx.type}`);
                console.log(`      Qty: ${tx.quantity}, Price: ${tx.price}`);
            });
        }
    } else {
        console.log('❌ No UserHolding found for MELI');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
