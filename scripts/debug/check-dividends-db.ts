import { prisma } from '../lib/prisma';

async function main() {
    const count = await prisma.cedearDividend.count();
    console.log(`📊 Total dividends in DB: ${count}`);

    const lastFive = await prisma.cedearDividend.findMany({
        orderBy: { announcementDate: 'desc' },
        take: 5
    });

    console.log('\n📅 Last 5 dividends:');
    lastFive.forEach(d => {
        console.log(`- ${d.ticker}: ${d.announcementDate.toISOString().split('T')[0]} (Amount: ${d.amount || 'Pending'})`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
