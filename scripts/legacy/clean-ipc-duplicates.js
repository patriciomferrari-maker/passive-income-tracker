const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicates() {
    console.log('\n🧹 Cleaning IPC Duplicates...\n');

    try {
        // 1. Clean EconomicIndicator duplicates
        console.log('Step 1: Cleaning EconomicIndicator (IPC)...');
        const allIPC = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' }
        });

        const grouped = {};
        allIPC.forEach(record => {
            const date = new Date(record.date);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(record);
        });

        let deletedCount = 0;
        for (const [key, records] of Object.entries(grouped)) {
            if (records.length > 1) {
                console.log(`  ${key}: ${records.length} records found`);
                // Keep the first (most recent due to desc order), delete others
                const toKeep = records[0];
                const toDelete = records.slice(1);

                for (const record of toDelete) {
                    await prisma.economicIndicator.delete({
                        where: { id: record.id }
                    });
                    deletedCount++;
                }
                console.log(`    ✓ Kept ${toKeep.date.toISOString().slice(0, 10)}, deleted ${toDelete.length}`);
            }
        }
        console.log(`✓ Deleted ${deletedCount} duplicate EconomicIndicator records\n`);

        // 2. Clean InflationData duplicates
        console.log('Step 2: Cleaning InflationData...');
        const allInflation = await prisma.inflationData.findMany({
            orderBy: [{ year: 'desc' }, { month: 'desc' }]
        });

        const inflationGrouped = {};
        allInflation.forEach(record => {
            const key = `${record.year}-${record.month}`;
            if (!inflationGrouped[key]) {
                inflationGrouped[key] = [];
            }
            inflationGrouped[key].push(record);
        });

        let deletedInflation = 0;
        for (const [key, records] of Object.entries(inflationGrouped)) {
            if (records.length > 1) {
                console.log(`  ${key}: ${records.length} records found`);
                // Keep first, delete others
                const toDelete = records.slice(1);

                for (const record of toDelete) {
                    await prisma.inflationData.delete({
                        where: { id: record.id }
                    });
                    deletedInflation++;
                }
                console.log(`    ✓ Deleted ${toDelete.length} duplicates`);
            }
        }
        console.log(`✓ Deleted ${deletedInflation} duplicate InflationData records\n`);

        // 3. Verify final state
        console.log('Step 3: Verifying final state...');
        const finalIPC = await prisma.economicIndicator.count({
            where: { type: 'IPC' }
        });
        const finalInflation = await prisma.inflationData.count();
        console.log(`  EconomicIndicator (IPC): ${finalIPC} records`);
        console.log(`  InflationData: ${finalInflation} records`);

        console.log('\n✅ Cleanup complete!\n');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDuplicates();
