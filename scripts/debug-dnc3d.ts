
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking transactions for DNC3D...");

    // Find investment first
    const inv = await prisma.investment.findFirst({
        where: { ticker: { contains: 'DNC3D' } },
        include: { transactions: true }
    });

    if (!inv) {
        console.log("Investment DNC3D not found.");
        return;
    }

    console.log(`Investment: ${inv.ticker} (Type: ${inv.type})`);
    console.log("Transactions:");
    inv.transactions.forEach(tx => {
        console.log(` - Date: ${tx.date.toISOString().split('T')[0]}, Amount: ${tx.totalAmount}, Currency: '${tx.currency}'`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
