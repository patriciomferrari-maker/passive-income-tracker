const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNow() {
    try {
        const records = await prisma.economicIndicator.findMany({
            where: {
                type: 'IPC',
                date: { gte: new Date('2025-01-01') }
            },
            orderBy: { date: 'desc' },
            select: { id: true, date: true, value: true }
        });

        console.log(`Total 2025 IPC records: ${records.length}\n`);

        records.forEach(r => {
            const dateStr = r.date.toISOString().substring(0, 10);
            console.log(`${dateStr} | ${r.value}% | ID: ${r.id}`);
        });

        // Check for duplicates
        const byMonth = {};
        records.forEach(r => {
            const key = r.date.toISOString().substring(0, 7);
            if (!byMonth[key]) byMonth[key] = [];
            byMonth[key].push(r);
        });

        console.log('\n\nDuplicates check:');
        Object.entries(byMonth).forEach(([month, recs]) => {
            if (recs.length > 1) {
                console.log(`❌ ${month}: ${recs.length} entries`);
                recs.forEach(r => console.log(`   - ${r.date.toISOString().substring(0, 10)} | ID: ${r.id}`));
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkNow();
