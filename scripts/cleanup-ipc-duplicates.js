const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicates() {
    try {
        console.log('🔍 Finding duplicate IPC entries by month...\n');

        // Get all IPC records
        const allRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' }
        });

        console.log(`Total IPC records: ${allRecords.length}`);

        // Group by year-month
        const byMonth = new Map();
        allRecords.forEach(record => {
            const monthKey = record.date.toISOString().substring(0, 7); // YYYY-MM
            if (!byMonth.has(monthKey)) {
                byMonth.set(monthKey, []);
            }
            byMonth.get(monthKey).push(record);
        });

        // Find duplicates
        const duplicateMonths = [];
        byMonth.forEach((records, monthKey) => {
            if (records.length > 1) {
                duplicateMonths.push({ monthKey, records });
            }
        });

        console.log(`\nFound ${duplicateMonths.length} months with duplicates:\n`);

        if (duplicateMonths.length === 0) {
            console.log('✅ No duplicates to clean');
            return;
        }

        // Show what will be deleted
        const toDelete = [];
        duplicateMonths.forEach(({ monthKey, records }) => {
            // Sort by date descending to keep the LAST day of the month
            records.sort((a, b) => b.date.getTime() - a.date.getTime());

            const keep = records[0]; // Keep the latest date
            const remove = records.slice(1); // Remove the rest

            console.log(`${monthKey}:`);
            console.log(`  ✅ KEEP: ${keep.date.toISOString().substring(0, 10)} (value: ${keep.value}%) - ID: ${keep.id}`);
            remove.forEach(r => {
                console.log(`  ❌ DELETE: ${r.date.toISOString().substring(0, 10)} (value: ${r.value}%) - ID: ${r.id}`);
                toDelete.push(r.id);
            });
        });

        console.log(`\n📊 Summary:`);
        console.log(`   Total duplicates to delete: ${toDelete.length}`);
        console.log(`   Months affected: ${duplicateMonths.length}`);

        // Confirm deletion
        console.log('\n⚠️  Deleting duplicates...');

        const deleteResult = await prisma.economicIndicator.deleteMany({
            where: {
                id: { in: toDelete }
            }
        });

        console.log(`\n✅ Deleted ${deleteResult.count} duplicate records`);

        // Verify
        const remaining = await prisma.economicIndicator.count({
            where: { type: 'IPC' }
        });
        console.log(`📈 Remaining IPC records: ${remaining}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDuplicates();
