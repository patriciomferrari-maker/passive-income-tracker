
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- AUDIT START: Checking for Misclassified Investments ---');

    const users = await prisma.user.findMany({ select: { id: true, email: true } });

    for (const user of users) {
        console.log(`\nUser: ${user.email}`);

        // 1. Get All Investments and their types
        const investments = await prisma.investment.findMany({
            where: { userId: user.id },
            select: { id: true, ticker: true, name: true, type: true, _count: { select: { transactions: true } } },
            orderBy: { type: 'asc' }
        });

        if (investments.length === 0) {
            console.log("  No investments found.");
            continue;
        }

        console.log(`  Found ${investments.length} total investments.`);

        // 2. Heuristic Check
        // Common ONs often have "-D", "-C", "YPF", "PAMP", "GEN", "AERO" etc.
        // Common Treasuries are "T-Bill", "Bond", "Note"
        // ETFs are "SPY", "QQQ", etc.

        const suspicious = [];
        const treasuries = investments.filter(i => i.type === 'TREASURY');
        const ons = investments.filter(i => i.type === 'ON' || i.type === 'CORPORATE_BOND');

        console.log(`  > Treasuries: ${treasuries.length}`);
        treasuries.forEach(inv => {
            console.log(`    [TREASURY] ${inv.ticker} (${inv.name}) - Txs: ${inv._count.transactions}`);
            // Simple heuristic: If ticker looks like an Argentine ON
            if (inv.ticker.includes(' ') || inv.name.includes('YPF') || inv.name.includes('Pampa') || inv.name.includes('Vista')) {
                suspicious.push({ ...inv, reason: 'Looks like ON but is TREASURY' });
            }
        });

        console.log(`  > ONs: ${ons.length}`);
        ons.forEach(inv => {
            console.log(`    [ON] ${inv.ticker} (${inv.name}) - Txs: ${inv._count.transactions}`);
            // Simple heuristic: If ticker looks like US Treasury
            if (inv.name.includes('Treasury') || inv.name.includes('T-Bill')) {
                suspicious.push({ ...inv, reason: 'Looks like Treasury but is ON' });
            }
        });

        if (suspicious.length > 0) {
            console.log('\n  ⚠️ SUSPICIOUS ITEMS FOUND (May need manual fix):');
            suspicious.forEach(s => console.log(`    - ${s.ticker} (${s.type}) -> ${s.reason}`));
        } else {
            console.log('\n  ✅ No obvious misclassifications detected by heuristics.');
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
