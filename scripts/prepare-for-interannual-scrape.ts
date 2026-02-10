import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Checking IPC records without interannual values...\n');

    // Count records without interannual values
    const withoutInterannual = await prisma.economicIndicator.count({
        where: {
            type: 'IPC',
            interannualValue: null
        }
    });

    console.log(`Found ${withoutInterannual} IPC records without interannual values`);

    if (withoutInterannual === 0) {
        console.log('\n✅ All IPC records already have interannual values!');
        return;
    }

    console.log('\n🗑️  Deleting IPC records without interannual values...');

    const deleteResult = await prisma.economicIndicator.deleteMany({
        where: {
            type: 'IPC',
            interannualValue: null
        }
    });

    console.log(`✅ Deleted ${deleteResult.count} records`);
    console.log('\n✨ Database is ready for the scraper to populate with complete data (monthly + interannual values)');
    console.log('\nNext step: Run the scraper via POST to /api/admin/scrape-interannual-inflation');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
