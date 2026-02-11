import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Testing Alert Logic (Simulation)\n');

    // 1. Dollar Blue Alert Simulation
    console.log('💵 Testing Dollar Blue Logic:');
    const latest = await prisma.economicIndicator.findFirst({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });

    if (latest) {
        console.log(`   Latest Dollar Value: $${latest.value} (${latest.date.toLocaleDateString()})`);

        const previous = await prisma.economicIndicator.findFirst({
            where: {
                type: 'TC_USD_ARS',
                date: { lt: latest.date }
            },
            orderBy: { date: 'desc' }
        });

        if (previous) {
            console.log(`   Previous Dollar Value: $${previous.value} (${previous.date.toLocaleDateString()})`);
            const variation = ((latest.value - previous.value) / previous.value) * 100;
            console.log(`   Variation: ${variation.toFixed(2)}%`);

            if (Math.abs(variation) >= 3) {
                console.log('   🚨 ALERT WOULD TRIGGER (>3%)');
            } else {
                console.log('   ✅ No alert needed (<3%)');
            }
        } else {
            console.log('   ⚠️ No previous data found to compare.');
        }
    } else {
        console.log('   ⚠️ No dollar data found.');
    }

    // 2. Bank Maturity Alert Simulation
    console.log('\n🏦 Testing Bank Maturity Logic:');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Simulate finding maturities for "today" (or recent past just to see if any exist)
    const activePFs = await prisma.bankOperation.findMany({
        where: {
            type: 'PLAZO_FIJO',
            startDate: { not: null },
            durationDays: { not: null }
        },
        include: { user: true }
    });

    console.log(`   Found ${activePFs.length} active Plazo Fijos.`);

    activePFs.forEach(pf => {
        if (!pf.startDate || !pf.durationDays) return;
        const maturityDate = new Date(pf.startDate);
        maturityDate.setDate(maturityDate.getDate() + pf.durationDays);
        maturityDate.setHours(0, 0, 0, 0);

        console.log(`   - PF ${pf.alias || 'Unnamed'}: Matures ${maturityDate.toLocaleDateString()} (Amount: $${pf.amount})`);

        if (maturityDate.getTime() === today.getTime()) {
            console.log('     🚨 MATURES TODAY! Alert would trigger.');
        }
    });

    console.log('\n✅ Simulation complete.\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
