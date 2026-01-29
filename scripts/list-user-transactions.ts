import { prisma } from '@/lib/prisma';

async function main() {
    const userEmail = 'pruebajuan@gmail.com';

    console.log('🔍 Checking transactions for:', userEmail);
    console.log('');

    // 1. Find user
    const user = await prisma.user.findUnique({
        where: { email: userEmail }
    });

    if (!user) {
        console.log('❌ User not found');
        return;
    }

    console.log('✅ User found:', user.id);
    console.log('');

    // 2. Get all investments for this user
    const investments = await prisma.investment.findMany({
        where: { userId: user.id },
        include: {
            transactions: true
        }
    });

    console.log(`📊 Found ${investments.length} investments`);
    console.log('');

    // 3. List all transactions
    let totalTransactions = 0;
    for (const inv of investments) {
        if (inv.transactions.length > 0) {
            console.log(`\n📈 ${inv.ticker} (${inv.type})`);
            console.log(`   Investment ID: ${inv.id}`);
            console.log(`   Transactions: ${inv.transactions.length}`);

            inv.transactions.forEach((tx, idx) => {
                console.log(`   ${idx + 1}. ID: ${tx.id}`);
                console.log(`      Date: ${tx.date.toISOString().split('T')[0]}`);
                console.log(`      Qty: ${tx.quantity}, Price: ${tx.price}, Total: ${tx.totalAmount}`);
            });

            totalTransactions += inv.transactions.length;
        }
    }

    console.log('');
    console.log(`✅ Total transactions: ${totalTransactions}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
