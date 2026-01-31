const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
    try {
        // Simple query to check 2025 IPC data
        const records = await prisma.$queryRaw`
            SELECT date::text, value, "createdAt"::text, id
            FROM "EconomicIndicator"
            WHERE type = 'IPC' 
            AND date >= '2025-01-01'::date
            ORDER BY date DESC
            LIMIT 30
        `;

        console.log(`Found ${records.length} IPC records in 2025:\n`);
        records.forEach(r => {
            console.log(`${r.date.substring(0, 10)} | Value: ${r.value} | ID: ${r.id}`);
        });

        // Check for duplicates
        const duplicateCheck = await prisma.$queryRaw`
            SELECT date::text, COUNT(*)::int as count
            FROM "EconomicIndicator"
            WHERE type = 'IPC' 
            AND date >= '2025-01-01'::date
            GROUP BY date
            HAVING COUNT(*) > 1
        `;

        if (duplicateCheck.length > 0) {
            console.log(`\n\n⚠️  Found ${duplicateCheck.length} duplicate dates:`);
            duplicateCheck.forEach(d => {
                console.log(`  ${d.date.substring(0, 10)} - ${d.count} entries`);
            });
        } else {
            console.log('\n\n✅ No duplicates found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDuplicates();
