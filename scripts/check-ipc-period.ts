import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check IPC data for December 2025 - February 2026
    const ipcData = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date('2025-12-01'),
                lte: new Date('2026-02-28')
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log('\n📊 IPC Data (Dec 2025 - Feb 2026):\n');

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

    // Show what the accumulated would be
    if (ipcData.length > 0) {
        let accumulated = 1;
        ipcData.forEach(ipc => {
            accumulated *= (1 + ipc.value / 100);
        });
        const percentageAccumulated = (accumulated - 1) * 100;
        console.log(`\nAccumulated (compound): ${percentageAccumulated.toFixed(2)}%`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
