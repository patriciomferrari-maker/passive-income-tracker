import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteIncorrectIPC() {
    console.log('🔍 Finding and deleting incorrect IPC entry for January 2026...\n');

    try {
        // Find the entry with 0.03 (which displays as 0.0%)
        const entry = await prisma.economicIndicator.findFirst({
            where: {
                type: 'IPC',
                date: {
                    gte: new Date('2026-01-01'),
                    lt: new Date('2026-02-01')
                }
            }
        });

        if (!entry) {
            console.log('❌ No entry found for January 2026');
            return;
        }

        console.log(`Found entry: ${entry.id}`);
        console.log(`  Date: ${entry.date.toISOString().slice(0, 10)}`);
        console.log(`  Value: ${entry.value}`);
        console.log(`  isManual: ${entry.isManual}`);

        await prisma.economicIndicator.delete({
            where: { id: entry.id }
        });

        console.log('\n✅ Deleted incorrect entry');
        console.log('You can now re-add January 2026 with the correct value (3.0)');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

deleteIncorrectIPC();
