const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIntegrity() {
    console.log('--- Checking Investment Market Integrity ---');

    const investments = await prisma.investment.findMany();
    let issues = 0;

    for (const inv of investments) {
        let expectedMarket = null;

        // Rule 1: TREASURY and ETF (US) should be market 'US'
        if (inv.type === 'TREASURY' || inv.type === 'ETF_US') {
            expectedMarket = 'US';
        }
        // Rule 2: ON, CEDEAR, CORPORATE_BOND, ETF (ARG) should be market 'ARG'
        // Note: ETF type is ambiguous, assumed US usually, but here we support ARG ETFs now?
        // Let's rely on explicit types if possible.
        // If type is 'ETF', check if it's a known US ETF? Or check currency?
        // Simplification: ARS currency -> ARG market. USD currency -> Depends.

        if (['ON', 'CEDEAR', 'CORPORATE_BOND'].includes(inv.type)) {
            expectedMarket = 'ARG';
        }

        if (expectedMarket && inv.market !== expectedMarket) {
            console.error(`[ISSUE] Investment ${inv.ticker} (${inv.type}) has market '${inv.market}' but expected '${expectedMarket}'`);
            issues++;
            // Optional: Auto-fix?
            // await prisma.investment.update({ where: { id: inv.id }, data: { market: expectedMarket } });
            // console.log(`[FIX] Updated ${inv.ticker} to market '${expectedMarket}'`);
        }
    }

    if (issues === 0) {
        console.log('✅ No market integrity issues found.');
    } else {
        console.log(`❌ Found ${issues} issues.`);
    }

    await prisma.$disconnect();
}

checkIntegrity();
