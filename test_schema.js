const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSchema() {
    console.log('Testing Prisma schema...');

    try {
        // Test if RentalCashflow model exists
        console.log('Checking RentalCashflow model...');
        const cashflows = await prisma.rentalCashflow.findMany();
        console.log(`✅ RentalCashflow model exists. Found ${cashflows.length} cashflows`);

        // Test if Contract.rentalCashflows relation exists
        console.log('Checking Contract.rentalCashflows relation...');
        const contracts = await prisma.contract.findMany({
            include: {
                rentalCashflows: true
            }
        });
        console.log(`✅ Contract.rentalCashflows relation OK. Found ${contracts.length} contracts`);

        console.log('\n✅ All schema checks passed!');
    } catch (error) {
        console.error('❌ Schema error:', error.message);
        console.error('\nPlease run: npx prisma generate');
    } finally {
        await prisma.$disconnect();
    }
}

testSchema();
