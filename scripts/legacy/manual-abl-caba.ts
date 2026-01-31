import { PrismaClient } from '@prisma/client';
import { checkABLCABA } from '../lib/scrapers/abl-caba';

const prisma = new PrismaClient();

async function manualABLCABACheck() {
    console.log('🏛️  Manual ABL CABA Check\n');
    console.log('⚠️  Note: This script is for CABA ABL only (has reCAPTCHA)');
    console.log('⚠️  You will need to solve the captcha manually\n');

    try {
        // Get CABA properties with municipal IDs
        const properties = await prisma.property.findMany({
            where: {
                jurisdiction: 'CABA',
                municipalId: { not: null }
            },
            select: {
                id: true,
                name: true,
                municipalId: true
            }
        });

        if (properties.length === 0) {
            console.log('❌ No CABA properties with municipal IDs found');
            return;
        }

        console.log(`📋 Found ${properties.length} CABA properties:\n`);

        for (const property of properties) {
            console.log(`🏠 ${property.name}`);
            console.log(`   Municipal ID: ${property.municipalId}`);
            console.log(`   Portal: https://lb.agip.gob.ar/ConsultaABL/`);
            console.log(`\n   ⚠️  Please check manually and enter the result:\n`);

            // For now, just show the link
            // In the future, could add interactive prompts to enter status manually
            console.log('');
        }

        console.log('\n💡 Tip: Open the portal links above and check each property manually');
        console.log('💡 ABL Provincia is automated - this is only for CABA');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

manualABLCABACheck()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
