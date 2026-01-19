
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting IPC Duplicates Cleanup...');

    // 1. Clean EconomicIndicator
    // Target: Dec 2025 (2025-12-01) - Remove 2.9, Keep 2.8
    // Note: Dates are stored as UTC noon or midnight. We need to be careful with matching.
    // The check script showed: 
    // 2.9: 2025-12-01T12:00:00.000Z (Created recently)
    // 2.8: 2025-12-31T12:00:00.000Z (Created earlier, has interannual) -> Wait, 2.8 is mapped to Dec 31?
    // Let's look at the check script output again from history if possible, or just query by value.

    // Strategy: Find all IPC for Dec 2025 range and keep the one with 2.8 value.
    const dec2025Start = new Date('2025-12-01T00:00:00Z');
    const dec2025End = new Date('2026-01-01T00:00:00Z');

    const indicators = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: { gte: dec2025Start, lt: dec2025End }
        }
    });

    console.log(`Found ${indicators.length} identifiers for Dec 2025:`, indicators.map(i => `${i.value}% (${i.date.toISOString()})`));

    for (const ind of indicators) {
        if (Math.abs(ind.value - 2.9) < 0.01) {
            console.log(`❌ Deleting incorrect EconomicIndicator: ${ind.id} (${ind.value}%)`);
            await prisma.economicIndicator.delete({ where: { id: ind.id } });
        } else {
            console.log(`✅ Keeping correct EconomicIndicator: ${ind.id} (${ind.value}%)`);
        }
    }

    // 2. Clean InflationData (Legacy)
    // Just to be safe, although we are moving away from it.
    const legacyRecords = await prisma.inflationData.findMany({
        where: { year: 2025, month: 12 }
    });

    for (const rec of legacyRecords) {
        if (Math.abs(rec.value - 2.9) < 0.01) {
            console.log(`❌ Deleting incorrect InflationData (Legacy): ${rec.id} (${rec.value}%)`);
            await prisma.inflationData.delete({ where: { id: rec.id } });
        }
    }

    console.log('🧹 Cleanup finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
