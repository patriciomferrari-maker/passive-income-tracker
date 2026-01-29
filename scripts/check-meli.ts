import { prisma } from '@/lib/prisma';

async function main() {
    const userEmail = 'pruebajuan@gmail.com';

    console.log('🔍 Checking for MELI investment...');
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

    // 2. Find MELI investment
    const meliInvestment = await prisma.investment.findFirst({
        where: {
            userId: user.id,
            ticker: 'MELI'
        },
        include: {
            transactions: true
        }
    });

    if (!meliInvestment) {
        console.log('❌ No MELI investment found');
        return;
    }

    console.log('✅ MELI Investment found:');
    console.log('   ID:', meliInvestment.id);
    console.log('   Ticker:', meliInvestment.ticker);
    console.log('   Name:', meliInvestment.name);
    console.log('   Type:', meliInvestment.type);
    console.log('   Market:', meliInvestment.market);
    console.log('   Transactions:', meliInvestment.transactions.length);
    console.log('');

    if (meliInvestment.transactions.length > 0) {
        console.log('📊 Transactions:');
        meliInvestment.transactions.forEach((tx, idx) => {
            console.log(`   ${idx + 1}. ID: ${tx.id}`);
            console.log(`      Date: ${tx.date.toISOString().split('T')[0]}`);
            console.log(`      Qty: ${tx.quantity}, Price: ${tx.price}`);
            console.log(`      Total: ${tx.totalAmount}`);
        });
    } else {
        console.log('⚠️  Investment exists but has NO transactions');
        console.log('   This is the problem - orphaned investment record');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
