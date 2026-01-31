
import { prisma } from '../lib/prisma';
import { applySplitToAsset } from '../app/lib/split-service';

async function main() {
    console.log('🧪 Starting Split Logic Test...');

    // 1. Setup
    const ticker = 'SPLIT_TEST_CEDEAR';

    // Find a user
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found');
    console.log(`👤 Using user: ${user.email}`);

    // Clean previous run
    await prisma.transaction.deleteMany({ where: { investment: { ticker } } });
    await prisma.investment.deleteMany({ where: { ticker, userId: user.id } });
    await prisma.globalAsset.deleteMany({ where: { ticker } });
    await prisma.assetSplitHistory.deleteMany({ where: { ticker } });

    // Create Asset
    const asset = await prisma.globalAsset.create({
        data: {
            ticker,
            name: 'Split Test Asset',
            type: 'CEDEAR',
            ratio: '2:1',
            market: 'ARG',
            currency: 'ARS'
        }
    });

    // Create Investment
    const inv = await prisma.investment.create({
        data: {
            userId: user.id,
            ticker,
            name: 'Split Test Asset',
            type: 'CEDEAR',
            currency: 'ARS',
            market: 'ARG'
        }
    });

    // Create Transaction
    await prisma.transaction.create({
        data: {
            investmentId: inv.id,
            date: new Date(),
            type: 'BUY',
            quantity: 100,
            price: 1000,
            currency: 'ARS',
            totalAmount: -100000
        }
    });

    console.log('✅ Setup complete. Initial State: Ratio 2:1, Qty 100, Price 1000.');

    // 2. Apply Split (2:1 -> 60:1, Multiplier 30)
    const oldRatio = '2:1';
    const newRatio = '60:1';
    const multiplier = 30;

    console.log(`🔄 Applying split x${multiplier}...`);
    await applySplitToAsset(asset.id, ticker, oldRatio, newRatio, multiplier);

    // 3. Verify
    const updatedAsset = await prisma.globalAsset.findUnique({ where: { id: asset.id } });
    const updatedInv = await prisma.investment.findUnique({
        where: { id: inv.id },
        include: { transactions: true }
    });
    const updatedTx = await prisma.transaction.findFirst({ where: { investmentId: inv.id } });
    const history = await prisma.assetSplitHistory.findFirst({ where: { ticker } });

    // Compute quantity from transactions
    const computedQty = updatedInv?.transactions.reduce((sum, t) =>
        sum + (t.type === 'BUY' ? t.quantity : -t.quantity), 0) || 0;

    console.log('--- Verification ---');
    console.log(`Asset Ratio: ${updatedAsset?.ratio} (Expected: 60:1)`);
    console.log(`Computed Quantity: ${computedQty} (Expected: 3000)`);
    console.log(`Tx Quantity: ${updatedTx?.quantity} (Expected: 3000)`);
    console.log(`Tx Price: ${updatedTx?.price} (Expected: ~33.33)`);
    console.log(`History Logged: ${!!history}`);

    if (
        updatedAsset?.ratio === '60:1' &&
        computedQty === 3000 &&
        updatedTx?.quantity === 3000 &&
        Math.abs((updatedTx?.price || 0) - 33.333) < 0.1
    ) {
        console.log('✅ TEST PASSED');
    } else {
        console.error('❌ TEST FAILED');
    }

    // Cleanup
    await prisma.transaction.deleteMany({ where: { investment: { ticker } } });
    await prisma.investment.deleteMany({ where: { ticker, userId: user.id } });
    await prisma.globalAsset.deleteMany({ where: { ticker } });
    await prisma.assetSplitHistory.deleteMany({ where: { ticker } });
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
