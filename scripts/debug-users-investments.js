
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Users & US Investments ---');
    try {
        const users = await prisma.user.findMany({
            include: {
                _count: {
                    select: { investments: { where: { market: 'US' } } }
                }
            }
        });

        for (const u of users) {
            console.log(`User: ${u.email} (ID: ${u.id}) - US Investments: ${u._count.investments}`);

            if (u._count.investments > 0) {
                const invs = await prisma.investment.findMany({
                    where: { userId: u.id, market: 'US' },
                    select: { ticker: true, type: true, name: true }
                });
                invs.forEach(i => console.log(`   > [${i.type}] ${i.ticker}: ${i.name}`));
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
