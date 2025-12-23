const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllTCTypes() {
    try {
        console.log('\n=== CHECKING ALL TC TYPES ===\n');

        // Get all unique types
        const allTypes = await prisma.economicIndicator.findMany({
            distinct: ['type'],
            select: { type: true }
        });

        console.log('All types in EconomicIndicator:', allTypes.map(t => t.type));
        console.log('\n');

        // Check each type
        for (const typeObj of allTypes) {
            const type = typeObj.type;
            const data = await prisma.economicIndicator.findMany({
                where: { type },
                orderBy: { date: 'asc' },
                select: { date: true }
            });

            if (data.length > 0) {
                console.log(`${type}:`);
                console.log(`  Desde: ${data[0].date.toISOString().slice(0, 10)}`);
                console.log(`  Hasta: ${data[data.length - 1].date.toISOString().slice(0, 10)}`);
                console.log(`  Total: ${data.length} registros\n`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAllTCTypes();
