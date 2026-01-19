
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking IPC values for Dec 2025 and Jan 2026...');

    const startDate = new Date('2025-12-01T00:00:00Z');
    const endDate = new Date('2026-02-01T00:00:00Z');

    console.log('--- Checking EconomicIndicator (New Table) ---');
    const indicators = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: startDate,
                lt: endDate,
            },
        },
        orderBy: {
            date: 'asc',
        },
    });

    console.log('Found indicators:', indicators);

    if (indicators.length === 0) {
        console.log("No indicators found in range.");
    }

    console.log('\n--- Checking InflationData (Legacy Table) ---');
    const inflationData = await prisma.inflationData.findMany({
        where: {
            year: { in: [2025, 2026] }
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
    });
    console.log('Found InflationData:', inflationData.filter(i => (i.year === 2025 && i.month === 12) || (i.year === 2026 && i.month === 1)));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
