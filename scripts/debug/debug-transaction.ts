import { prisma } from '@/lib/prisma';

async function main() {
    const txId = 'cmkx489q70009qgftif7snmqg'; // The transaction ID from logs
    const userId = 'cmkx0p22v00004jdxcv7fmrtj'; // The user ID from logs

    console.log('🔍 Checking transaction:', txId);
    console.log('👤 User ID:', userId);
    console.log('');

    // 1. Check if transaction exists at all
    const tx = await prisma.transaction.findUnique({
        where: { id: txId },
        include: {
            investment: true
        }
    });

    if (!tx) {
        console.log('❌ Transaction does NOT exist in database');
        return;
    }

    console.log('✅ Transaction exists');
    console.log('   Investment ID:', tx.investmentId);
    console.log('   Investment User ID:', tx.investment.userId);
    console.log('   Ticker:', tx.investment.ticker);
    console.log('   Date:', tx.date);
    console.log('   Quantity:', tx.quantity);
    console.log('   Price:', tx.price);
    console.log('');

    // 2. Check ownership
    if (tx.investment.userId === userId) {
        console.log('✅ User OWNS this transaction');
    } else {
        console.log('❌ User does NOT own this transaction');
        console.log('   Expected user:', userId);
        console.log('   Actual owner:', tx.investment.userId);
    }

    // 3. Check with the same query as the API
    const apiQuery = await prisma.transaction.findFirst({
        where: {
            id: txId,
            investment: { userId }
        }
    });

    console.log('');
    console.log('API Query Result:', apiQuery ? '✅ Found' : '❌ Not Found');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
