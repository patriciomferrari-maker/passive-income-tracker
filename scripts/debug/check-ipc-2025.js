// Check if IPC has 2025 data
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIPC2025() {
    console.log('Checking IPC data for 2025...\n');

    const ipc2025 = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date('2025-01-01'),
                lte: new Date('2025-12-31')
            }
        },
        orderBy: { date: 'asc' },
        select: {
            date: true,
            value: true
        }
    });

    console.log('IPC 2025 count:', ipc2025.length);
    ipc2025.forEach(item => {
        console.log('  ', item.date.toISOString().split('T')[0], '→', item.value);
    });

    await prisma.$disconnect();
}

checkIPC2025().catch(console.error);
