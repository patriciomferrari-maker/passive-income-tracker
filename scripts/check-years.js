
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.inflationData.groupBy({
        by: ['year'],
        _count: { month: true },
        orderBy: { year: 'desc' }
    });
    console.log('InflationData records by year:', JSON.stringify(counts, null, 2));
}

main().finally(() => prisma.$disconnect());
