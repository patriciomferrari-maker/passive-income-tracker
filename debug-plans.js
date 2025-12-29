const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const plans = await prisma.barbosaInstallmentPlan.findMany({
            include: {
                transactions: true
            }
        });

        console.log(`Found ${plans.length} plans.`);

        plans.forEach(p => {
            const paid = p.transactions.filter(t => t.status === 'REAL').length;
            const total = p.installmentsCount;
            const isFinished = paid >= total;

            console.log(`Plan: ${p.description}`);
            console.log(`- ID: ${p.id}`);
            console.log(`- Progress: ${paid}/${total}`);
            console.log(`- Calculated Finished: ${isFinished}`);
            console.log(`- Transactions Count: ${p.transactions.length}`);

            // Check dates of transactions
            const lastTx = p.transactions[p.transactions.length - 1];
            console.log(`- Last Tx Date: ${lastTx ? lastTx.date : 'N/A'}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
