
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const data = await prisma.inflationData.findMany({
        where: {
            year: {
                in: [2023, 2024, 2025]
            }
        },
        orderBy: [
            { year: 'asc' },
            { month: 'asc' }
        ]
    });

    console.log('Inflation Data Check (2023-2025):');
    if (data.length === 0) {
        console.log('NO DATA FOUND.');
    }
    data.forEach(d => {
        console.log(`Year: ${d.year}, Month: ${d.month}, Value: ${d.value} (Type: ${typeof d.value})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
