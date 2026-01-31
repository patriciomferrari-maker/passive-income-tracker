/**
 * REGRESSION TEST: Rental Individual Flow
 * 
 * This script verifies the integrity of the data pipeline for the "Flujo Individual" tab.
 * Usage: npx tsx scripts/verify-rental-flow.ts
 * 
 * It mimics the frontend behavior:
 * 1. Fetching user contracts
 * 2. Fetching details for a specific contract
 * 3. Fetching cashflows and verifying date integrity
 * 
 * If this script fails, the frontend tab is likely broken.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmixq96ww0000l8pp4w1zu2cy'; // Patricio
    console.log(`User: ${userId}`);

    // 1. Load Contracts (mimic /api/rentals/contracts)
    console.log('--- 1. Fetching All Contracts ---');
    const contracts = await prisma.contract.findMany({
        where: { property: { userId } },
        include: { property: true },
        orderBy: { startDate: 'desc' }
    });
    console.log(`Found ${contracts.length} contracts.`);

    if (contracts.length === 0) {
        console.log('No contracts found. Flow ends.');
        return;
    }

    const selectedContract = contracts[0];
    const contractId = selectedContract.id;
    console.log(`Selected Contract: ${selectedContract.property.name} (${contractId})`);

    // 2. Load Contract Details (mimic /api/rentals/contracts/[id])
    console.log(`--- 2. Fetching Contract Details for ${contractId} ---`);
    const contractDetail = await prisma.contract.findUnique({
        where: { id: contractId },
        include: { property: true, rentalCashflows: { orderBy: { date: 'asc' } } }
    });

    if (!contractDetail) {
        console.error('ERROR: Contract not found via ID fetch!');
        return;
    }
    console.log('Contract Detail Fetch Success.');

    // 3. Load Cashflows (mimic /api/rentals/contracts/[id]/cashflows)
    console.log(`--- 3. Fetching Cashflows for ${contractId} ---`);
    const cashflows = await prisma.rentalCashflow.findMany({
        where: { contractId: contractId },
        orderBy: { date: 'asc' }
    });
    console.log(`Found ${cashflows.length} cashflows.`);

    if (cashflows.length > 0) {
        // Fix dates logic check
        const fixedDateCashflows = cashflows.map(cf => {
            const d = new Date(cf.date);
            return {
                date_orig: cf.date,
                date_fixed: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0)).toISOString(),
                amount: cf.amountUSD || cf.amountARS
            };
        });
        console.log('Example Cashflow Fixed Date:', fixedDateCashflows[0]);
    } else {
        console.warn('WARNING: No cashflows found for this contract.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
