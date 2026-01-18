import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDuplicateIPC() {
    console.log('🔍 Finding duplicate IPC records...\n');

    try {
        // Get all IPC records
        const allRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' }
        });

        console.log(`📊 Total IPC records: ${allRecords.length}`);

        // Group by month
        const byMonth = new Map<string, typeof allRecords>();

        allRecords.forEach(record => {
            const monthKey = record.date.toISOString().slice(0, 7); // YYYY-MM
            if (!byMonth.has(monthKey)) {
                byMonth.set(monthKey, []);
            }
            byMonth.get(monthKey)!.push(record);
        });

        // Find duplicates
        const duplicateMonths = Array.from(byMonth.entries())
            .filter(([_, records]) => records.length > 1);

        console.log(`⚠️  Found ${duplicateMonths.length} months with duplicates\n`);

        if (duplicateMonths.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }

        let totalDeleted = 0;

        // For each duplicate month, keep the best record
        for (const [month, records] of duplicateMonths) {
            console.log(`📅 ${month}: ${records.length} records`);

            // Sort by priority:
            // 1. Has interannualValue (most complete)
            // 2. Most recent createdAt
            const sorted = records.sort((a, b) => {
                // Prefer records with interannual value
                if (a.interannualValue !== null && b.interannualValue === null) return -1;
                if (a.interannualValue === null && b.interannualValue !== null) return 1;

                // If both have or both don't have interannual, prefer newer
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            const toKeep = sorted[0];
            const toDelete = sorted.slice(1);

            console.log(`  ✅ Keeping: ${toKeep.id} (value: ${toKeep.value}, interannual: ${toKeep.interannualValue ?? 'N/A'})`);

            for (const record of toDelete) {
                console.log(`  ❌ Deleting: ${record.id} (value: ${record.value}, interannual: ${record.interannualValue ?? 'N/A'})`);
                await prisma.economicIndicator.delete({
                    where: { id: record.id }
                });
                totalDeleted++;
            }
        }

        console.log(`\n✅ Cleanup complete!`);
        console.log(`📊 Deleted ${totalDeleted} duplicate records`);
        console.log(`📊 Remaining records: ${allRecords.length - totalDeleted}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

removeDuplicateIPC();
