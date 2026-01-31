
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- DATA DIAGNOSTIC ---");

    // 1. List all users and their inventory
    const users = await prisma.user.findMany({
        include: {
            _count: {
                select: {
                    properties: true,
                    investments: true,
                    debts: true,
                    bankOperations: true,
                    costaTransactions: true
                }
            }
        }
    });

    if (users.length === 0) {
        console.log("NO USERS FOUND.");
    } else {
        console.log(`Found ${users.length} users:`);
        users.forEach(u => {
            console.log(`- [${u.email}] (ID: ${u.id})`);
            console.log(`  Properties: ${u._count.properties}`);
            console.log(`  Investments: ${u._count.investments}`);
            console.log(`  Debts: ${u._count.debts}`);
            console.log(`  Bank Ops: ${u._count.bankOperations}`);
            console.log(`  Costa Tx: ${u._count.costaTransactions}`);
            console.log("------------------------------------------------");
        });
    }

    // 2. Check for orphaned Costa data (since these are optional)
    const orphanedCosta = await prisma.costaTransaction.count({ where: { userId: null } });
    console.log(`Orphaned Costa Transactions: ${orphanedCosta}`);

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
