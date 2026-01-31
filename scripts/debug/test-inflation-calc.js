const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCalculation() {
    try {
        console.log('📊 Testing inflation accumulation calculation\n');

        // Get first 6 months of IPC data
        const ipcRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true },
            take: 6
        });

        console.log('Monthly inflation data (first 6 months):');
        ipcRecords.forEach(r => {
            console.log(`  ${r.date.toISOString().substring(0, 7)}: ${r.value}%`);
        });

        // Manual calculation
        console.log('\n📐 Manual calculation of accumulated inflation:');
        let accumulated = 100;
        console.log(`  Month 0 (base): 100`);

        ipcRecords.forEach((r, i) => {
            if (i > 0) {
                accumulated *= (1 + r.value / 100);
            }
            const percentage = accumulated - 100;
            console.log(`  Month ${i + 1} (${r.value}% monthly): ${accumulated.toFixed(4)} → ${percentage.toFixed(2)}% accumulated`);
        });

        // Get API data
        const apiResponse = await fetch('http://localhost:3000/api/economic-data/accumulated');
        const apiData = await apiResponse.json();

        console.log('\n📡 API returned values (first 6):');
        apiData.data.slice(0, 6).forEach((d, i) => {
            console.log(`  ${d.date}: ${d.inflacionAcumulada.toFixed(2)}%`);
        });

        // Compare
        console.log('\n🔍 Comparison:');
        apiData.data.slice(0, 6).forEach((d, i) => {
            const manual = i === 0 ? 0 : ipcRecords.slice(1, i + 1).reduce((acc, r) => acc * (1 + r.value / 100), 1) * 100 - 100;
            const api = d.inflacionAcumulada;
            const match = Math.abs(manual - api) < 0.01 ? '✅' : '❌';
            console.log(`  Month ${i + 1}: Manual=${manual.toFixed(2)}%, API=${api.toFixed(2)}% ${match}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCalculation();
