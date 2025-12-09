
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fetching all investments...');
    const investments = await prisma.investment.findMany({
        select: {
            id: true,
            ticker: true,
            type: true,
            userId: true,
            name: true
        }
    });

    console.log(`Found ${investments.length} total investments.`);

    const onInvestments = investments.filter(i => ['ON', 'CEDEAR'].includes(i.type));
    console.log(`Found ${onInvestments.length} investments with type ON or CEDEAR.`);

    onInvestments.forEach(inv => {
        console.log(`- [${inv.type}] ${inv.name} (Ticker: '${inv.ticker}') User: ${inv.userId}`);
    });

    if (onInvestments.length === 0) {
        console.log('No ON/CEDEAR investments found. Listing all types present:');
        const types = new Set(investments.map(i => i.type));
        console.log([...types]);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
