const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugYTDDates() {
    try {
        const ipcData = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' },
            select: { date: true, value: true }
        });

        console.log('\n=== All IPC Records (DESC) ===');
        console.log(`Total: ${ipcData.length}\n`);

        ipcData.slice(0, 12).forEach(d => {
            console.log(`${d.date.toISOString().slice(0, 10)} | ${d.value}`);
        });

        // Transform like the frontend does
        const ipcProcessed = ipcData.map(item => {
            const date = new Date(item.date);
            return {
                date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
                value: item.value
            };
        }).sort((a, b) => a.date.localeCompare(b.date));

        console.log('\n=== After Frontend Processing (ASC) ===');
        console.log(`Total: ${ipcProcessed.length}\n`);

        console.log('First 3:');
        ipcProcessed.slice(0, 3).forEach(d => console.log(`  ${d.date}`));

        console.log('\nLast 5:');
        ipcProcessed.slice(-5).forEach(d => console.log(`  ${d.date}`));

        const lastIPCDate = new Date(ipcProcessed[ipcProcessed.length - 1].date);
        console.log(`\nlastIPCDate: ${lastIPCDate.toISOString().slice(0, 10)}`);
        console.log(`lastIPCDate month key: ${lastIPCDate.getFullYear()}-${String(lastIPCDate.getMonth() + 1).padStart(2, '0')}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugYTDDates();
