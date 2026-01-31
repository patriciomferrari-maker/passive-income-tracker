
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const data2019 = [
    { month: 1, value: 2.9 },
    { month: 2, value: 3.8 },
    { month: 3, value: 4.7 },
    { month: 4, value: 3.4 },
    { month: 5, value: 3.1 },
    { month: 6, value: 2.7 },
    { month: 7, value: 2.2 },
    { month: 8, value: 4.0 },
    { month: 9, value: 5.9 },
    { month: 10, value: 3.3 },
    { month: 11, value: 4.3 },
    { month: 12, value: 3.7 }
];

async function main() {
    console.log('Seeding 2019 IPC data...');
    for (const d of data2019) {
        await prisma.inflationData.upsert({
            where: { year_month: { year: 2019, month: d.month } },
            update: { value: d.value },
            create: { year: 2019, month: d.month, value: d.value }
        });
    }
    console.log('Done seeding 2019.');
}

main().finally(() => prisma.$disconnect());
