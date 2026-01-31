
import { PrismaClient } from '@prisma/client';
import { updateONs } from '../app/lib/market-data';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { email: 'patriciomferrari@gmail.com' } });
    if (!user) throw new Error('User not found');

    console.log('Running updateONs for user:', user.email);
    const results = await updateONs(user.id);
    console.log('Results:', results.filter(r => r.ticker.includes('BRK')));

    // Check DB after update
    const brkb = await prisma.investment.findFirst({
        where: { ticker: 'BRKB', userId: user.id },
        include: { assetPrices: true }
    });
    console.log('\nBRKB After Update:');
    console.log('LastPrice:', brkb?.lastPrice);
    console.log('AssetPrices:', brkb?.assetPrices);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
