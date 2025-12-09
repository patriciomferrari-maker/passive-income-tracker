
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUGGING TREASURY DATA ---');

    // Get all TREASURY investments
    const investments = await prisma.investment.findMany({
        where: { type: 'TREASURY' },
        include: {
            transactions: true,
            cashflows: true
        }
    });

    console.log(`Found ${investments.length} TREASURY investments.`);

    for (const inv of investments) {
        console.log(`\n[${inv.ticker}] ${inv.name} (ID: ${inv.id})`);
        console.log(`  User ID: ${inv.userId}`);

        // Check Transactions
        console.log(`  Transactions: ${inv.transactions.length}`);
        let totalQty = 0;
        let totalInvested = 0;
        inv.transactions.forEach(tx => {
            console.log(`    - [${tx.type}] Date: ${tx.date.toISOString()} Qty: ${tx.quantity} Amount: ${tx.totalAmount}`);
            if (tx.type === 'BUY') {
                totalQty += tx.quantity;
                totalInvested += Math.abs(tx.totalAmount);
            } else if (tx.type === 'SELL') {
                totalQty -= tx.quantity;
            }
        });
        console.log(`  > Calculated Position from Tx: ${totalQty} nominals`);
        console.log(`  > Calculated Invested: $${totalInvested}`);

        // Check Cashflows
        console.log(`  Cashflows: ${inv.cashflows.length}`);
        const futureCashflows = inv.cashflows.filter(cf => cf.status === 'PROJECTED');
        console.log(`  > Future/Projected: ${futureCashflows.length}`);

        if (futureCashflows.length > 0) {
            const firstCf = futureCashflows[0];
            console.log(`    - First Future CF: ${firstCf.date.toISOString()} Amount: ${firstCf.amount} Type: ${firstCf.type}`);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
