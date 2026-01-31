import { PrismaClient } from '@prisma/client';
import { checkNaturgy } from '../lib/scrapers/naturgy';

const prisma = new PrismaClient();

async function checkAllNaturgy() {
    console.log('🔥 Starting Naturgy checks for all Provincia properties...\n');

    try {
        // Get all Provincia properties with gas
        const properties = await prisma.property.findMany({
            where: {
                gasId: { not: null },
                jurisdiction: 'PROVINCIA'
            },
            select: {
                id: true,
                name: true,
                gasId: true,
                userId: true
            }
        });

        console.log(`📊 Found ${properties.length} Provincia properties with Naturgy\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const property of properties) {
            console.log(`🏠 Checking: ${property.name} (${property.gasId})`);

            try {
                const result = await checkNaturgy(property.gasId!);

                // Save to database
                await prisma.utilityCheck.create({
                    data: {
                        propertyId: property.id,
                        serviceType: 'GAS',
                        accountNumber: property.gasId!,
                        status: result.status,
                        debtAmount: result.debtAmount,
                        lastBillAmount: result.lastBillAmount,
                        lastBillDate: result.lastBillDate,
                        dueDate: result.dueDate,
                        isAutomatic: true,
                        errorMessage: result.errorMessage
                    }
                });

                if (result.status === 'ERROR' || result.status === 'UNKNOWN') {
                    console.log(`  ⚠️  ${result.status}: ${result.errorMessage || 'Unknown status'}`);
                    errorCount++;
                } else {
                    console.log(`  ✅ ${result.status} - Debt: $${result.debtAmount}`);
                    successCount++;
                }
            } catch (error: any) {
                console.error(`  ❌ Error: ${error.message}`);

                // Save error to database
                await prisma.utilityCheck.create({
                    data: {
                        propertyId: property.id,
                        serviceType: 'GAS',
                        accountNumber: property.gasId!,
                        status: 'ERROR',
                        debtAmount: 0,
                        isAutomatic: true,
                        errorMessage: error.message
                    }
                });
                errorCount++;
            }

            console.log(''); // Empty line between properties
        }

        console.log('📊 Summary:');
        console.log(`  ✅ Successful: ${successCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log('🎉 Naturgy checks completed!\n');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the checks
checkAllNaturgy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
