
import { prisma } from '@/lib/prisma';
import { checkMetrogas } from '@/lib/scrapers/metrogas';
import { checkNaturgyRapipago as checkNaturgy } from '@/lib/scrapers/naturgy-rapipago';
import { checkEdenor } from '@/lib/scrapers/edenor';
import { checkABLProvincia } from '@/lib/scrapers/abl-provincia';
import { checkABLCABA } from '@/lib/scrapers/abl-caba';

export async function scrapeAllUtilities(specificPropertyId?: string) {
    console.log('🔍 Starting utility checks...');

    try {
        // Get properties
        const whereClause = specificPropertyId
            ? { id: specificPropertyId }
            : {
                OR: [
                    { gasId: { not: null } },
                    { electricityId: { not: null } },
                    { municipalId: { not: null } },
                    { garageMunicipalId: { not: null } }
                ]
            };

        const properties = await prisma.property.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                jurisdiction: true,
                gasId: true,
                electricityId: true,
                municipalId: true,
                aysaId: true,
                hasGarage: true,
                garageMunicipalId: true,
                userId: true
            }
        });

        console.log(`📊 Processing ${properties.length} properties`);

        const results = [];

        for (const property of properties) {
            console.log(`\n🏠 Processing: ${property.name}`);
            const propResults = { property: property.name, checks: [] as any[] };

            // Check Gas
            if (property.gasId) {
                try {
                    const gasProvider = property.jurisdiction === 'CABA' ? 'Metrogas' : 'Naturgy';
                    const result = property.jurisdiction === 'CABA'
                        ? await checkMetrogas(property.gasId)
                        : await checkNaturgy(property.gasId);

                    await verifyAndSave(property.id, 'GAS', property.gasId, result);
                    propResults.checks.push({ type: 'GAS', status: result.status, debt: result.debtAmount });
                } catch (e: any) {
                    await saveError(property.id, 'GAS', property.gasId, e.message);
                    propResults.checks.push({ type: 'GAS', status: 'ERROR', error: e.message });
                }
            }

            // Check Edenor
            if (property.electricityId) {
                try {
                    const result = await checkEdenor(property.electricityId);
                    await verifyAndSave(property.id, 'ELECTRICITY', property.electricityId, result);
                    propResults.checks.push({ type: 'ELECTRICITY', status: result.status, debt: result.debtAmount });
                } catch (e: any) {
                    await saveError(property.id, 'ELECTRICITY', property.electricityId, e.message);
                    propResults.checks.push({ type: 'ELECTRICITY', status: 'ERROR', error: e.message });
                }
            }

            // Check ABL
            if (property.municipalId) {
                try {
                    const result = property.jurisdiction === 'CABA'
                        ? await checkABLCABA(property.municipalId)
                        : await checkABLProvincia(property.municipalId);

                    await verifyAndSave(property.id, 'MUNICIPAL', property.municipalId, result);
                    propResults.checks.push({ type: 'MUNICIPAL', status: result.status, debt: result.debtAmount });
                } catch (e: any) {
                    await saveError(property.id, 'MUNICIPAL', property.municipalId, e.message);
                    propResults.checks.push({ type: 'MUNICIPAL', status: 'ERROR', error: e.message });
                }
            }

            // Check Garage ABL
            if (property.hasGarage && property.garageMunicipalId && property.jurisdiction === 'PROVINCIA') {
                try {
                    const result = await checkABLProvincia(property.garageMunicipalId);
                    await verifyAndSave(property.id, 'MUNICIPAL', property.garageMunicipalId, result);
                    propResults.checks.push({ type: 'MUNICIPAL_GARAGE', status: result.status, debt: result.debtAmount });
                } catch (e: any) {
                    await saveError(property.id, 'MUNICIPAL', property.garageMunicipalId, e.message);
                    propResults.checks.push({ type: 'MUNICIPAL_GARAGE', status: 'ERROR', error: e.message });
                }
            }

            results.push(propResults);
        }

        return results;

    } catch (error) {
        console.error('❌ Fatal error during utility checks:', error);
        throw error;
    }
}

async function verifyAndSave(propertyId: string, type: string, accountNumber: string, result: any) {
    // Basic validation
    if (!result) throw new Error('No result returned from scraper');

    // Create record
    return prisma.utilityCheck.create({
        data: {
            propertyId,
            serviceType: type,
            accountNumber,
            status: result.status,
            debtAmount: result.debtAmount,
            lastBillAmount: result.lastBillAmount,
            lastBillDate: result.lastBillDate,
            dueDate: result.dueDate,
            isAutomatic: true,
            errorMessage: result.errorMessage
        }
    });
}

async function saveError(propertyId: string, type: string, accountNumber: string, message: string) {
    return prisma.utilityCheck.create({
        data: {
            propertyId,
            serviceType: type,
            accountNumber,
            status: 'ERROR',
            debtAmount: 0,
            isAutomatic: true,
            errorMessage: message
        }
    });
}
