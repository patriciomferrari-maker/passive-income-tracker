// Check November 2025 data across all indicators
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNovember2025() {
    console.log('Checking November 2025 data...\n');

    // UVA
    const uva = await prisma.economicIndicator.findFirst({
        where: {
            type: 'UVA',
            date: {
                gte: new Date('2025-11-01'),
                lt: new Date('2025-12-01')
            }
        }
    });
    console.log('UVA Nov 2025:', uva ? `${uva.date.toISOString().split('T')[0]} = ${uva.value}` : 'NOT FOUND');

    // IPC
    const ipc = await prisma.inflationData.findFirst({
        where: {
            year: 2025,
            month: 11
        }
    });
    console.log('IPC Nov 2025:', ipc ? `${ipc.year}-${ipc.month} = ${ipc.value}%` : 'NOT FOUND');

    // TC Blue
    const tcBlue = await prisma.economicIndicator.findFirst({
        where: {
            type: 'TC_USD_ARS',
            date: {
                gte: new Date('2025-11-01'),
                lt: new Date('2025-12-01')
            }
        },
        orderBy: { date: 'desc' }
    });
    console.log('TC Blue Nov 2025:', tcBlue ? `${tcBlue.date.toISOString().split('T')[0]} = ${tcBlue.value}` : 'NOT FOUND');

    // TC Oficial
    const tcOficial = await prisma.economicIndicator.findFirst({
        where: {
            type: 'TC_OFICIAL',
            date: {
                gte: new Date('2025-11-01'),
                lt: new Date('2025-12-01')
            }
        },
        orderBy: { date: 'desc' }
    });
    console.log('TC Oficial Nov 2025:', tcOficial ? `${tcOficial.date.toISOString().split('T')[0]} = ${tcOficial.value}` : 'NOT FOUND');

    await prisma.$disconnect();
}

checkNovember2025().catch(console.error);
