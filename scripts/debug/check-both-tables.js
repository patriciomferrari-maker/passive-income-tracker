const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBothTables() {
    try {
        // Check EconomicIndicator
        const economic = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' },
            take: 15
        });

        console.log('\n=== EconomicIndicator (IPC) ===');
        console.log(`Total: ${economic.length} records\n`);
        economic.forEach(d => {
            const date = new Date(d.date);
            const ym = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            console.log(`${ym} | Value: ${d.value} | Interannual: ${d.interannualValue || '-'}`);
        });

        // Check InflationData
        const inflation = await prisma.inflationData.findMany({
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: 15
        });

        console.log('\n=== InflationData ===');
        console.log(`Total: ${inflation.length} records\n`);
        inflation.forEach(d => {
            const ym = `${d.year}-${d.month.toString().padStart(2, '0')}`;
            console.log(`${ym} | Value: ${d.value}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkBothTables();
