const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showAll2025() {
    try {
        const data = await prisma.economicIndicator.findMany({
            where: {
                type: 'IPC',
                date: {
                    gte: new Date('2025-01-01'),
                    lt: new Date('2026-01-01')
                }
            },
            orderBy: { date: 'desc' }
        });

        console.log(`\nTotal 2025 IPC records: ${data.length}\n`);
        console.log('Full Date                | Value | Interannual | ID');
        console.log('------------------------------------------------');

        data.forEach(d => {
            console.log(`${d.date.toISOString()} | ${d.value.toString().padStart(5)} | ${(d.interannualValue || '-').toString().padStart(11)} | ${d.id.slice(0, 12)}`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

showAll2025();
