import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🔍 Checking for MELI in GlobalAsset...');
    console.log('');

    const meliGlobal = await prisma.globalAsset.findFirst({
        where: {
            ticker: 'MELI',
            market: 'ARG'
        }
    });

    if (!meliGlobal) {
        console.log('❌ MELI not found in GlobalAsset');
        return;
    }

    console.log('✅ MELI found in GlobalAsset:');
    console.log('   ID:', meliGlobal.id);
    console.log('   Ticker:', meliGlobal.ticker);
    console.log('   Name:', meliGlobal.name);
    console.log('   Type:', meliGlobal.type);
    console.log('   Market:', meliGlobal.market);
    console.log('   Last Price:', meliGlobal.lastPrice);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
