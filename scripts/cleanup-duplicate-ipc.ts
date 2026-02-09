import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🧹 Cleaning up duplicate IPC entries...\n');

    // Get ALL IPC data
    const ipcData = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' }
    });

    console.log(`Total IPC records: ${ipcData.length}`);

    // Group by year-month
    const grouped = new Map<string, Array<{ id: string, date: Date, value: number }>>();

    ipcData.forEach(ipc => {
        const date = new Date(ipc.date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!grouped.has(yearMonth)) {
            grouped.set(yearMonth, []);
        }
        grouped.get(yearMonth)!.push({
            id: ipc.id,
            date: ipc.date,
            value: ipc.value
        });
    });

    let duplicateMonths = 0;
    let recordsToDelete = 0;
    const idsToDelete: string[] = [];

    // For each month with duplicates, keep only the one with the latest date
    for (const [yearMonth, entries] of grouped.entries()) {
        if (entries.length > 1) {
            duplicateMonths++;

            // Sort by date descending
            entries.sort((a, b) => b.date.getTime() - a.date.getTime());

            // Keep the first one (latest date), mark others for deletion
            const toKeep = entries[0];
            const toDelete = entries.slice(1);

            console.log(`\n📅 ${yearMonth} - ${entries.length} entries`);
            console.log(`   ✅ KEEPING: ${toKeep.date.toISOString().split('T')[0]} (${toKeep.value}%) - ID: ${toKeep.id.substring(0, 8)}...`);

            toDelete.forEach(entry => {
                console.log(`   ❌ DELETING: ${entry.date.toISOString().split('T')[0]} (${entry.value}%) - ID: ${entry.id.substring(0, 8)}...`);
                idsToDelete.push(entry.id);
                recordsToDelete++;
            });
        }
    }

    console.log('\n---');
    console.log(`Months with duplicates: ${duplicateMonths}`);
    console.log(`Records to delete: ${recordsToDelete}`);
    console.log(`Records to keep: ${ipcData.length - recordsToDelete}`);

    // Ask for confirmation
    console.log('\n⚠️  This will DELETE ' + recordsToDelete + ' IPC records.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🗑️  Deleting duplicate records...');

    const result = await prisma.economicIndicator.deleteMany({
        where: {
            id: {
                in: idsToDelete
            }
        }
    });

    console.log(`\n✅ Deleted ${result.count} duplicate IPC records`);
    console.log(`\n📊 Remaining records: ${ipcData.length - result.count}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
