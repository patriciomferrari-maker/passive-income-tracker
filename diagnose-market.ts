
import { prisma } from './lib/prisma';

async function main() {
    console.log('Diagnosing Investment Markets...');
    const investments = await prisma.investment.findMany({
        where: {
            type: { in: ['CEDEAR', 'ETF'] }
        },
        select: {
            id: true,
            ticker: true,
            type: true,
            market: true,
            name: true
        }
    });

    console.table(investments);
}

main();
