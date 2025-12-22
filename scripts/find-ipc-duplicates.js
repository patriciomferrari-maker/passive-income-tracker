const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
    try {
        const data = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' }
        });

        console.log(`\nTotal IPC records: ${data.length}\n`);

        // Group by year-month
        const grouped = {};
        data.forEach(d => {
            const date = new Date(d.date);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(d);
        });

        // Show duplicates
        console.log('Duplicates found:\n');
        Object.keys(grouped).sort().reverse().forEach(key => {
            if (grouped[key].length > 1) {
                console.log(`${key}: ${grouped[key].length} records`);
                grouped[key].forEach(d => {
                    console.log(`  - ${d.date.toISOString().slice(0, 10)} | Value: ${d.value} | Interannual: ${d.interannualValue} | ID: ${d.id.slice(0, 12)}`);
                });
            }
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDuplicates();
