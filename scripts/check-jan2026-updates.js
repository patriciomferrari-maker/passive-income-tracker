// Check rental contracts with updates in January 2026
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getNextAdjustmentDate(startDate, adjustmentFrequency) {
    const start = new Date(startDate);
    const today = new Date();

    // Calculate how many adjustment periods have passed
    const monthsElapsed = (today.getFullYear() - start.getFullYear()) * 12 +
        (today.getMonth() - start.getMonth());

    // Calculate next adjustment
    const adjustmentsPassed = Math.floor(monthsElapsed / adjustmentFrequency);
    const nextAdjustmentMonths = (adjustmentsPassed + 1) * adjustmentFrequency;

    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + nextAdjustmentMonths);

    return nextDate;
}

async function checkJan2026Updates() {
    console.log('Checking rental contracts with adjustments in January 2026...\n');

    // Get all contracts with properties
    const contracts = await prisma.contract.findMany({
        include: {
            property: true
        }
    });

    console.log(`Total contracts: ${contracts.length}\n`);

    // Filter contracts with next adjustment in January 2026
    const jan2026Start = new Date('2026-01-01');
    const jan2026End = new Date('2026-01-31T23:59:59');

    const contractsWithJan2026Update = contracts.filter(c => {
        if (!c.adjustmentFrequency || c.adjustmentType === 'NONE') return false;

        const nextUpdate = getNextAdjustmentDate(c.startDate, c.adjustmentFrequency);
        return nextUpdate >= jan2026Start && nextUpdate <= jan2026End;
    });

    console.log(`Contracts with adjustment in January 2026: ${contractsWithJan2026Update.length}\n`);

    if (contractsWithJan2026Update.length > 0) {
        console.log('Details:');
        contractsWithJan2026Update.forEach(c => {
            const nextUpdate = getNextAdjustmentDate(c.startDate, c.adjustmentFrequency);
            console.log(`\n  📍 ${c.property.name}`);
            console.log(`     Address: ${c.property.address || 'N/A'}`);
            console.log(`     Tenant: ${c.tenantName || 'N/A'}`);
            console.log(`     Start date: ${c.startDate.toISOString().split('T')[0]}`);
            console.log(`     Adjustment: ${c.adjustmentType} every ${c.adjustmentFrequency} months`);
            console.log(`     Next update: ${nextUpdate.toISOString().split('T')[0]}`);
            console.log(`     Initial rent: ${c.currency} ${c.initialRent}`);
        });
    }

    await prisma.$disconnect();
}

checkJan2026Updates().catch(console.error);
