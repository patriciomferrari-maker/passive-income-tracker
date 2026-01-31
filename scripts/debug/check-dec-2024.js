const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDec2024() {
    try {
        // Check for Dec 2024
        const dec2024 = await prisma.economicIndicator.findMany({
            where: {
                type: 'IPC',
                date: {
                    gte: new Date('2024-12-01'),
                    lt: new Date('2025-01-01')
                }
            }
        });

        console.log('\n=== December 2024 IPC Data ===');
        console.log(`Found ${dec2024.length} records\n`);

        if (dec2024.length > 0) {
            dec2024.forEach(d => {
                console.log(`Date: ${d.date.toISOString().slice(0, 10)}`);
                console.log(`Value: ${d.value}`);
                console.log(`Interannual: ${d.interannualValue}`);
            });
        } else {
            console.log('❌ NO December 2024 data found!');
            console.log('This is why YTD starts at November instead');
        }

        // Check November 2024
        const nov2024 = await prisma.economicIndicator.findMany({
            where: {
                type: 'IPC',
                date: {
                    gte: new Date('2024-11-01'),
                    lt: new Date('2024-12-01')
                }
            }
        });

        console.log('\n=== November 2024 IPC Data ===');
        console.log(`Found ${nov2024.length} records\n`);

        if (nov2024.length > 0) {
            nov2024.forEach(d => {
                console.log(`Date: ${d.date.toISOString().slice(0, 10)}`);
                console.log(`Value: ${d.value}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDec2024();
