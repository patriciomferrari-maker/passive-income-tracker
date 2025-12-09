
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUG START ---');

    const users = await prisma.user.findMany({
        include: {
            _count: {
                select: { investments: true }
            }
        }
    });

    console.log(`Total Users: ${users.length}`);

    for (const u of users) {
        const user = u as any;

        // Count transactions manually
        const txCount = await prisma.transaction.count({
            where: {
                investment: { userId: user.id }
            }
        });

        console.log(`User: ${user.email} (ID: ${user.id})`);
        console.log(`  - Investments: ${user._count.investments}`);
        console.log(`  - Transactions: ${txCount}`);

        if (txCount > 0) {
            console.log(`  --- Sample Transactions for ${user.email} ---`);
            const txs = await prisma.transaction.findMany({
                where: {
                    investment: { userId: user.id }
                },
                include: {
                    investment: {
                        select: { ticker: true, type: true, name: true }
                    }
                },
                take: 10
            });

            txs.forEach(tx => {
                console.log(`    [${tx.investment.type}] ${tx.investment.ticker} - ${tx.investment.name}`);
            });

            // Test the Filter specifically for this user
            console.log(`  --- Testing Filter TREASURY,ETF for ${user.email} ---`);
            const filteredTxs = await prisma.transaction.findMany({
                where: {
                    investment: {
                        userId: user.id,
                        type: { in: ['TREASURY', 'ETF'] }
                    }
                }
            });
            console.log(`    Filtered Count (TREASURY,ETF): ${filteredTxs.length}`);

            console.log(`  --- Testing Filter ON,CORPORATE_BOND for ${user.email} ---`);
            const filteredOnTxs = await prisma.transaction.findMany({
                where: {
                    investment: {
                        userId: user.id,
                        type: { in: ['ON', 'CORPORATE_BOND'] }
                    }
                }
            });
            console.log(`    Filtered Count (ON,CORPORATE_BOND): ${filteredOnTxs.length}`);
        }
        console.log('------------------------------------------------');
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
