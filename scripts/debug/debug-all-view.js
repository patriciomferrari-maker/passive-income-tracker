// Debug script to check what's happening with ALL view calculation
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    // Get IPC data
    const ipc = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' }
    });

    // Get TC data
    const tc = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'asc' }
    });

    console.log('IPC Data:');
    console.log(`  First: ${ipc[0]?.date} (${ipc[0]?.value}%)`);
    console.log(`  Last: ${ipc[ipc.length - 1]?.date} (${ipc[ipc.length - 1]?.value}%)`);
    console.log(`  Total: ${ipc.length} records`);

    console.log('\nTC Blue Data:');
    console.log(`  First: ${tc[0]?.date} ($${tc[0]?.value})`);
    console.log(`  Last: ${tc[tc.length - 1]?.date} ($${tc[tc.length - 1]?.value})`);
    console.log(`  Total: ${tc.length} records`);

    // Find data gaps
    console.log('\nFirst 5 months with BOTH:');
    let count = 0;
    for (const ipcRecord of ipc) {
        const monthKey = ipcRecord.date.toISOString().slice(0, 7);
        const tcRecord = tc.find(t => t.date.toISOString().slice(0, 7) === monthKey);
        if (tcRecord && count < 5) {
            console.log(`  ${monthKey}: IPC=${ipcRecord.value}%, TC=$${tcRecord.value}`);
            count++;
        }
    }

    await prisma.$disconnect();
}

debug();
