import { PrismaClient } from '@prisma/client';
import { checkMetrogas } from '../lib/scrapers/metrogas';

const prisma = new PrismaClient();

async function manualMetrogasCheck() {
    console.log('🔥 Running manual Metrogas check for Soldado...\n');

    // Find Soldado property
    const soldado = await prisma.property.findFirst({
        where: {
            name: 'Soldado'
        }
    });

    if (!soldado || !soldado.gasId) {
        console.log('❌ Soldado property or gas ID not found');
        return;
    }

    console.log(`Found Soldado: ${soldado.gasId}\n`);

    // Run scraper
    const result = await checkMetrogas(soldado.gasId);

    console.log('\n📊 Scraper result:');
    console.log(JSON.stringify(result, null, 2));

    // Save to database
    await prisma.utilityCheck.create({
        data: {
            propertyId: soldado.id,
            serviceType: 'GAS',
            accountNumber: soldado.gasId,
            status: result.status,
            debtAmount: result.debtAmount,
            lastBillAmount: result.lastBillAmount,
            lastBillDate: result.lastBillDate,
            dueDate: result.dueDate,
            isAutomatic: false, // Manual check
            errorMessage: result.errorMessage
        }
    });

    console.log('\n✅ Check saved to database');

    await prisma.$disconnect();
}

manualMetrogasCheck()
    .then(() => {
        console.log('\n🎉 Manual check completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    });
