
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking TC Data Range...');

    const lastTC = await prisma.economicIndicator.findFirst({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' },
    });

    const firstTC = await prisma.economicIndicator.findFirst({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'asc' },
    });

    if (lastTC) {
        console.log(`Last TC Date: ${lastTC.date.toISOString()}, Value: ${lastTC.value}`);
    } else {
        console.log('No TC Data found.');
    }

    if (firstTC) {
        console.log(`First TC Date: ${firstTC.date.toISOString()}`);
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
