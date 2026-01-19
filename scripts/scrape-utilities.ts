import { PrismaClient } from '@prisma/client';
import { checkMetrogas } from '../lib/scrapers/metrogas';
import { checkEdenor } from '../lib/scrapers/edenor';

const prisma = new PrismaClient();

export async function scrapeAllUtilities() {
    console.log('🔍 Starting utility checks for all properties...');

    try {
        // Get all properties with utility IDs
        const properties = await prisma.property.findMany({
            where: {
                OR: [
                    { gasId: { not: null } },
                    { electricityId: { not: null } }
                ]
            },
            select: {
                id: true,
                name: true,
                gasId: true,
                electricityId: true,
                userId: true
            }
        });

        console.log(`📊 Found ${properties.length} properties with utility accounts`);

        let successCount = 0;
        let errorCount = 0;

        for (const property of properties) {
            console.log(`\n🏠 Processing: ${property.name}`);

            // Check Metrogas
            if (property.gasId) {
                try {
                    console.log(`  🔥 Checking Metrogas (${property.gasId})...`);
                    const result = await checkMetrogas(property.gasId);

                    await prisma.utilityCheck.create({
                        data: {
                            propertyId: property.id,
                            serviceType: 'GAS',
                            accountNumber: property.gasId,
                            status: result.status,
                            debtAmount: result.debtAmount,
                            lastBillAmount: result.lastBillAmount,
                            lastBillDate: result.lastBillDate,
                            dueDate: result.dueDate,
                            isAutomatic: true,
                            errorMessage: result.errorMessage
                        }
                    });

                    if (result.status === 'ERROR') {
                        console.log(`  ❌ Metrogas check failed: ${result.errorMessage}`);
                        errorCount++;
                    } else {
                        console.log(`  ✅ Metrogas: ${result.status} (Debt: $${result.debtAmount})`);
                        successCount++;
                    }
                } catch (error: any) {
                    console.error(`  ❌ Error checking Metrogas:`, error.message);

                    // Save error status
                    await prisma.utilityCheck.create({
                        data: {
                            propertyId: property.id,
                            serviceType: 'GAS',
                            accountNumber: property.gasId,
                            status: 'ERROR',
                            debtAmount: 0,
                            isAutomatic: true,
                            errorMessage: error.message
                        }
                    });
                    errorCount++;
                }
            }

            // Check Edenor
            if (property.electricityId) {
                try {
                    console.log(`  ⚡ Checking Edenor (${property.electricityId})...`);
                    const result = await checkEdenor(property.electricityId);

                    await prisma.utilityCheck.create({
                        data: {
                            propertyId: property.id,
                            serviceType: 'ELECTRICITY',
                            accountNumber: property.electricityId,
                            status: result.status,
                            debtAmount: result.debtAmount,
                            lastBillAmount: result.lastBillAmount,
                            lastBillDate: result.lastBillDate,
                            dueDate: result.dueDate,
                            isAutomatic: true,
                            errorMessage: result.errorMessage
                        }
                    });

                    if (result.status === 'ERROR') {
                        console.log(`  ❌ Edenor check failed: ${result.errorMessage}`);
                        errorCount++;
                    } else {
                        console.log(`  ✅ Edenor: ${result.status} (Debt: $${result.debtAmount})`);
                        successCount++;
                    }
                } catch (error: any) {
                    console.error(`  ❌ Error checking Edenor:`, error.message);

                    // Save error status
                    await prisma.utilityCheck.create({
                        data: {
                            propertyId: property.id,
                            serviceType: 'ELECTRICITY',
                            accountNumber: property.electricityId,
                            status: 'ERROR',
                            debtAmount: 0,
                            isAutomatic: true,
                            errorMessage: error.message
                        }
                    });
                    errorCount++;
                }
            }

            // Delay between properties to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('\n📊 Summary:');
        console.log(`  ✅ Successful checks: ${successCount}`);
        console.log(`  ❌ Failed checks: ${errorCount}`);
        console.log('🎉 Utility checks completed!');

    } catch (error) {
        console.error('❌ Fatal error during utility checks:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    scrapeAllUtilities()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}
