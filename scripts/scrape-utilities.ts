import { PrismaClient } from '@prisma/client';
import { checkMetrogas } from '@/lib/scrapers/metrogas';
import { checkEdenor } from '@/lib/scrapers/edenor';

const prisma = new PrismaClient();

export async function scrapeAllUtilities() {
    console.log('[Utilities] Starting utility checks...');

    try {
        // Get all properties with utility IDs
        const properties = await prisma.property.findMany({
            where: {
                OR: [
                    { gasId: { not: null, not: '' } },
                    { electricityId: { not: null, not: '' } }
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

        console.log(`[Utilities] Found ${properties.length} properties with utility IDs`);

        for (const property of properties) {
            console.log(`[Utilities] Checking property: ${property.name}`);

            // Check Metrogas
            if (property.gasId) {
                console.log(`[Utilities] Checking Metrogas for ${property.name}...`);
                try {
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

                    console.log(`[Utilities] ✅ Metrogas check saved for ${property.name}`);
                } catch (error: any) {
                    console.error(`[Utilities] ❌ Error checking Metrogas for ${property.name}:`, error.message);

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
                }
            }

            // Check Edenor
            if (property.electricityId) {
                console.log(`[Utilities] Checking Edenor for ${property.name}...`);
                try {
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

                    console.log(`[Utilities] ✅ Edenor check saved for ${property.name}`);
                } catch (error: any) {
                    console.error(`[Utilities] ❌ Error checking Edenor for ${property.name}:`, error.message);

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
                }
            }

            // Wait between properties to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('[Utilities] ✅ All utility checks complete');

    } catch (error) {
        console.error('[Utilities] ❌ Fatal error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Allow running directly
if (require.main === module) {
    scrapeAllUtilities()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
