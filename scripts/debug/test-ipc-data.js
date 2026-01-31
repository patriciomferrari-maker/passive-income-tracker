// Quick diagnostic script to test IPC API endpoint
import { prisma } from '../app/lib/prisma.js';

async function testIPCEndpoint() {
    console.log('🔍 Testing IPC data availability...\n');

    try {
        // Check if IPC data exists
        const ipcCount = await prisma.economicIndicator.count({
            where: { type: 'IPC' }
        });

        console.log(`📊 Total IPC records in database: ${ipcCount}`);

        if (ipcCount === 0) {
            console.log('⚠️  No IPC data found! Run seed-economic-data.ts first.');
            return;
        }

        // Fetch sample data
        const sampleData = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' },
            take: 5,
            select: {
                id: true,
                date: true,
                value: true,
                interannualValue: true
            }
        });

        console.log('\n📋 Sample IPC records:');
        sampleData.forEach(item => {
            const date = new Date(item.date);
            console.log(`  ${date.toISOString().slice(0, 7)}: ${(item.value * 100).toFixed(2)}% (Interanual: ${item.interannualValue ? (item.interannualValue * 100).toFixed(2) + '%' : 'N/A'})`);
        });

        console.log('\n✅ IPC data is available in database');
        console.log('💡 If admin panel shows "No hay datos", check:');
        console.log('   1. User has admin role');
        console.log('   2. Browser console for API errors');
        console.log('   3. Network tab for /api/admin/ipc response');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testIPCEndpoint();
