import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmixq96ww0000l8pp4w1zu2cy'; // Explicit user ID
    const now = new Date();

    console.log(`Checking rentals for user: ${userId}`);

    const allContracts = await prisma.contract.findMany({
        where: { property: { userId } },
        include: { property: true }
    });

    console.log(`Found ${allContracts.length} contracts.`);

    const activeContracts = allContracts.filter(c => {
        const start = new Date(c.startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + c.durationMonths);
        return start <= now && end >= now;
    });

    console.log(`Active contracts: ${activeContracts.length}`);

    for (const contract of activeContracts) {
        console.log(`\n--- Contract: ${contract.id} (${contract.property.name}) ---`);
        const cashflows = await prisma.rentalCashflow.findMany({
            where: { contractId: contract.id },
            orderBy: { date: 'asc' }
        });

        console.log(`Total Cashflows: ${cashflows.length}`);

        const todayEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month
        const filteredCashflows = cashflows.filter(cf => cf.date <= todayEnd);

        console.log(`Filtered Cashflows (<= ${todayEnd.toISOString()}): ${filteredCashflows.length}`);

        if (filteredCashflows.length > 0) {
            console.log('First 3:', filteredCashflows.slice(0, 3).map(cf => ({ date: cf.date.toISOString(), amount: cf.amountUSD || cf.amountARS })));
            console.log('Last 3:', filteredCashflows.slice(-3).map(cf => ({ date: cf.date.toISOString(), amount: cf.amountUSD || cf.amountARS })));
        } else {
            console.log('WARNING: No cashflows found after filter!');
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
