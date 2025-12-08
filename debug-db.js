
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Testing connection...');
    try {
        console.log('1. Fetching Investment (ON)...');
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON' },
            include: { transactions: true }
        });
        console.log('ON Investments:', onInvestments.length);

        console.log('2. Fetching Contracts...');
        const contracts = await prisma.contract.findMany({
            include: {
                rentalCashflows: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });
        console.log('Contracts:', contracts.length);

        console.log('3. Fetching Bank Ops...');
        const bankOperations = await prisma.bankOperation.findMany();
        console.log('Bank Ops:', bankOperations.length);

        console.log('4. Fetching Transactions...');
        const tx = await prisma.transaction.findMany();
        console.log('Transactions:', tx.length);

        console.log('Success!');
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
