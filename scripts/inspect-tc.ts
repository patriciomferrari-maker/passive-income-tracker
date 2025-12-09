
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting TC Records for late 2025...');

    const records = await prisma.economicIndicator.findMany({
        where: {
            type: 'TC_USD_ARS',
            date: {
                gte: new Date('2025-09-01T00:00:00Z'),
                lte: new Date('2025-12-31T23:59:59Z')
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Found ${records.length} records.`);
    records.forEach(r => {
        console.log(`${r.date.toISOString()}: ${r.value}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
