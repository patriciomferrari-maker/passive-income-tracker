const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCalculation() {
    // Get first 5 months of IPC data
    const ipcRecords = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' },
        select: { date: true, value: true },
        take: 6
    });

    console.log('First 6 IPC records:');
    ipcRecords.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.date.toISOString().slice(0, 10)} - ${r.value}%`);
    });

    // Simulate calculation
    console.log('\nSimulated calculation:');
    let accumulated = 1;

    console.log(`Month 1 (${ipcRecords[0].date.toISOString().slice(0, 7)}): 0%`);

    for (let i = 1; i < ipcRecords.length; i++) {
        const prevIPC = ipcRecords[i - 1].value;
        accumulated *= (1 + prevIPC / 100);
        const accPct = (accumulated - 1) * 100;
        console.log(`Month ${i + 1} (${ipcRecords[i].date.toISOString().slice(0, 7)}): ${accPct.toFixed(2)}% (prev month IPC: ${prevIPC}%)`);
    }

    await prisma.$disconnect();
}

testCalculation();
