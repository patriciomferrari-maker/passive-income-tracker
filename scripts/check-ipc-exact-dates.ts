import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Check ALL IPC data for Nov 2025 - Feb 2026 with exact dates
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

    console.log('\n📊 IPC Data (Nov 2025 - Feb 2026) with EXACT dates:\n');

    ipcData.forEach(ipc => {
        const date = new Date(ipc.date);
        console.log(`${date.toISOString().split('T')[0]} (${date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}): ${ipc.value}% - ID: ${ipc.id}`);
    });

    console.log('\n---');
    console.log(`Total records: ${ipcData.length}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
