const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check for cashflows with contractId (old rental cashflows)
    const rentalCashflows = await prisma.cashflow.findMany({
        where: {
            contractId: { not: null }
        }
    });

    console.log(`Found ${rentalCashflows.length} rental cashflows to migrate`);

    // Check for cashflows with NULL investmentId but no contractId
    const orphanCashflows = await prisma.cashflow.findMany({
        where: {
            investmentId: null,
            contractId: null
        }
    });

    console.log(`Found ${orphanCashflows.length} orphan cashflows (will be deleted)`);

    if (orphanCashflows.length > 0) {
        console.log('Deleting orphan cashflows...');
        await prisma.cashflow.deleteMany({
            where: {
                investmentId: null,
                contractId: null
            }
        });
        console.log('Orphan cashflows deleted');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
