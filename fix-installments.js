const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const today = new Date();
        console.log(`Resetting future transactions after ${today.toISOString()} to PROJECTED...`);

        const result = await prisma.barbosaTransaction.updateMany({
            where: {
                date: {
                    gt: today
                },
                status: 'REAL',
                installmentPlanId: {
                    not: null // Only fix installments
                }
            },
            data: {
                status: 'PROJECTED'
            }
        });

        console.log(`Updated ${result.count} transactions to PROJECTED.`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
