import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listCedearsAndETFs() {
    try {
        // Find patriciomferrari user
        const user = await prisma.user.findUnique({
            where: { email: 'patriciomferrari@gmail.com' }
        });

        if (!user) {
            console.log('❌ User patriciomferrari@gmail.com not found');
            return;
        }

        console.log(`✅ Found user: ${user.name || user.email} (${user.id})\n`);

        // Get all CEDEARs
        const cedears = await prisma.investment.findMany({
            where: {
                userId: user.id,
                type: 'CEDEAR'
            },
            orderBy: { ticker: 'asc' }
        });

        // Get all ETFs
        const etfs = await prisma.investment.findMany({
            where: {
                userId: user.id,
                type: 'ETF'
            },
            orderBy: { ticker: 'asc' }
        });

        console.log('📊 CEDEARs:');
        console.log('═'.repeat(80));
        if (cedears.length === 0) {
            console.log('  No CEDEARs found');
        } else {
            cedears.forEach(c => {
                console.log(`  ${c.ticker.padEnd(10)} - ${c.name}`);
                console.log(`    Currency: ${c.currency}, Market: ${c.market}`);
                if (c.lastPrice) {
                    console.log(`    Last Price: $${c.lastPrice} (${c.lastPriceDate?.toLocaleDateString('es-AR')})`);
                }
                console.log('');
            });
        }

        console.log('\n📊 ETFs:');
        console.log('═'.repeat(80));
        if (etfs.length === 0) {
            console.log('  No ETFs found');
        } else {
            etfs.forEach(e => {
                console.log(`  ${e.ticker.padEnd(10)} - ${e.name}`);
                console.log(`    Currency: ${e.currency}, Market: ${e.market}`);
                if (e.lastPrice) {
                    console.log(`    Last Price: $${e.lastPrice} (${e.lastPriceDate?.toLocaleDateString('es-AR')})`);
                }
                console.log('');
            });
        }

        console.log('\n📈 Summary:');
        console.log(`  Total CEDEARs: ${cedears.length}`);
        console.log(`  Total ETFs: ${etfs.length}`);
        console.log(`  Total: ${cedears.length + etfs.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listCedearsAndETFs();
