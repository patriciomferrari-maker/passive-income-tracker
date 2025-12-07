/**
 * Regenerate cashflows for all investments
 * Run this script after schema changes to update existing data
 */

import { prisma } from '../lib/prisma';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '../lib/investments';

async function regenerateAllCashflows() {
    try {
        console.log('Fetching all investments with transactions...');

        const investments = await prisma.investment.findMany({
            where: {
                transactions: {
                    some: {}
                }
            },
            select: {
                id: true,
                ticker: true
            }
        });

        console.log(`Found ${investments.length} investments to process`);

        for (const investment of investments) {
            console.log(`Processing ${investment.ticker}...`);
            try {
                const cashflows = await generateInvestmentCashflow(investment.id);
                await saveInvestmentCashflows(cashflows);
                console.log(`  ✓ Generated ${cashflows.length} cashflows`);
            } catch (error) {
                console.error(`  ✗ Error processing ${investment.ticker}:`, error);
            }
        }

        console.log('\n✓ Cashflow regeneration complete!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

regenerateAllCashflows();
