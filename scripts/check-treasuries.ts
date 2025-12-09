
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking TREASURY investments...');

    const investments = await prisma.investment.findMany({
        where: { type: 'TREASURY' },
        include: {
            user: true
        }
    });

    console.log(`Found ${investments.length} TREASURY investments.`);
    investments.forEach(i => {
        console.log(`ID: ${i.id}, User: ${i.user.email} (ID: ${i.userId}), Ticker: ${i.ticker}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
