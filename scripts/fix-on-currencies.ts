/**
 * Fix ON Cashflow Currencies
 * 
 * Updates all ON/CORPORATE_BOND cashflows to have currency = 'USD'
 * Run with: npx ts-node scripts/fix-on-currencies.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking ON/CORPORATE_BOND investments...\n');

    // Find all ON and CORPORATE_BOND investments
    const onInvestments = await prisma.investment.findMany({
        where: {
            type: {
                in: ['ON', 'CORPORATE_BOND']
            }
        },
        include: {
            cashflows: {
                select: {
                    id: true,
                    currency: true
                }
            }
        }
    });

    console.log(`Found ${onInvestments.length} ON/CORPORATE_BOND investments:\n`);

    // Show status before fix
    onInvestments.forEach(inv => {
        const arsCashflows = inv.cashflows.filter(cf => cf.currency === 'ARS').length;
        const usdCashflows = inv.cashflows.filter(cf => cf.currency === 'USD').length;

        console.log(`  ${inv.ticker}:`);
        console.log(`    Total cashflows: ${inv.cashflows.length}`);
        console.log(`    ARS: ${arsCashflows}, USD: ${usdCashflows}`);
        console.log(`    Needs fix: ${arsCashflows > 0 ? '✗ YES' : '✓ No'}\n`);
    });

    const totalCashflows = onInvestments.reduce((sum, inv) => sum + inv.cashflows.length, 0);
    const arsCashflows = onInvestments.reduce((sum, inv) =>
        sum + inv.cashflows.filter(cf => cf.currency === 'ARS').length, 0
    );

    if (arsCashflows === 0) {
        console.log('✅ All ON cashflows are already in USD. Nothing to fix!');
        return;
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Total cashflows: ${totalCashflows}`);
    console.log(`  Need conversion: ${arsCashflows} (ARS → USD)\n`);

    // Ask for confirmation
    console.log('⚠️  This will update ALL ON/CORPORATE_BOND cashflows to USD.');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔧 Updating cashflows...\n');

    // Get all investment IDs
    const investmentIds = onInvestments.map(inv => inv.id);

    // Update all cashflows
    const result = await prisma.cashflow.updateMany({
        where: {
            investmentId: {
                in: investmentIds
            }
        },
        data: {
            currency: 'USD'
        }
    });

    console.log(`✅ SUCCESS! Updated ${result.count} cashflows to USD\n`);

    // Show status after fix
    console.log('📋 Verification:');
    const updated = await prisma.investment.findMany({
        where: {
            type: {
                in: ['ON', 'CORPORATE_BOND']
            }
        },
        include: {
            cashflows: {
                select: {
                    currency: true
                }
            }
        }
    });

    updated.forEach(inv => {
        const usdCount = inv.cashflows.filter(cf => cf.currency === 'USD').length;
        const arsCount = inv.cashflows.filter(cf => cf.currency === 'ARS').length;
        console.log(`  ${inv.ticker}: ${usdCount} USD, ${arsCount} ARS ${arsCount === 0 ? '✓' : '✗'}`);
    });

    console.log('\n✅ All done! Refresh "Flujo por ON" to see the corrected values.');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
