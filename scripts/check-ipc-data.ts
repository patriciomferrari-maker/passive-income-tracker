import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check IPC data for November 2025 - February 2026
    const ipcData = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date('2025-11-01'),
                lte: new Date('2026-02-28')
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log('\n📊 IPC Data (Nov 2025 - Feb 2026):\n');

    ipcData.forEach(ipc => {
        const date = new Date(ipc.date);
        const formatted = date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        console.log(`${formatted}: ${ipc.value}%`);
    });

    console.log('\n---');
    console.log(`Total records: ${ipcData.length}`);

    // Check for duplicates
    const monthCounts = new Map();
    ipcData.forEach(ipc => {
        const yearMonth = `${ipc.date.getFullYear()}-${ipc.date.getMonth()}`;
        monthCounts.set(yearMonth, (monthCounts.get(yearMonth) || 0) + 1);
    });

    console.log('\nMonth counts:');
    monthCounts.forEach((count, yearMonth) => {
        if (count > 1) {
            console.log(`⚠️ ${yearMonth}: ${count} entries (DUPLICATE!)`);
        } else {
            console.log(`✓ ${yearMonth}: ${count} entry`);
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
