// Check UVA data in database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUVAData() {
    console.log('Checking UVA data in database...\n');

    // Count total UVA records
    const totalCount = await prisma.economicIndicator.count({
        where: { type: 'UVA' }
    });
    console.log('Total UVA records:', totalCount);

    // Get first and last UVA records
    const first = await prisma.economicIndicator.findFirst({
        where: { type: 'UVA' },
        orderBy: { date: 'asc' }
    });

    const last = await prisma.economicIndicator.findFirst({
        where: { type: 'UVA' },
        orderBy: { date: 'desc' }
    });

    console.log('\nFirst UVA record:', first ? `${first.date.toISOString().split('T')[0]} = ${first.value}` : 'NOT FOUND');
    console.log('Last UVA record:', last ? `${last.date.toISOString().split('T')[0]} = ${last.value}` : 'NOT FOUND');

    // Show first 10 records
    console.log('\nFirst 10 UVA records:');
    const first10 = await prisma.economicIndicator.findMany({
        where: { type: 'UVA' },
        orderBy: { date: 'asc' },
        take: 10
    });

    first10.forEach(record => {
        console.log(`  ${record.date.toISOString().split('T')[0]} = ${record.value}`);
    });

    await prisma.$disconnect();
}

checkUVAData().catch(console.error);
