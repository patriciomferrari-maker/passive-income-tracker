import { prisma } from '@/lib/prisma';
import { checkMetrogas } from '@/lib/scrapers/metrogas';
import { checkAysaWeb } from '@/lib/scrapers/aysa-web';
import { checkABLCABA } from '@/lib/scrapers/abl-caba';
import { checkABLProvincia } from '@/lib/scrapers/abl-provincia';
import { checkNaturgyRapipago as checkNaturgy } from '@/lib/scrapers/naturgy-rapipago';
import { checkEdenor } from '@/lib/scrapers/edenor';

interface CheckResult {
    propertyId: string;
    propertyName: string;
    service: string;
    status: string;
    debtAmount: number;
    error?: string;
}

interface UtilityCheckSummary {
    upToDate: number;
    overdue: number;
    unknown: number;
    errors: number;
    totalDebt: number;
    results: CheckResult[];
}

/**
 * Check all utilities for a given user
 * Used by:
 * - Automated cron (2x daily)
 * - Manual check API endpoint
 * - Debug scripts
 */
export async function checkAllUtilities(userId: string): Promise<UtilityCheckSummary> {
    console.log(`🔍 Starting utilities check for user ${userId}...`);

    const results: CheckResult[] = [];

    try {
        // Get all properties with utility IDs
        const properties = await prisma.property.findMany({
            where: {
                userId,
                OR: [
                    { gasId: { not: null } },
                    { electricityId: { not: null } },
                    { municipalId: { not: null } }
                ]
            },
            select: {
                id: true,
                name: true,
                gasId: true,
                aysaId: true,
                municipalId: true,
                electricityId: true,
                jurisdiction: true
            }
        });

        console.log(`📋 Found ${properties.length} properties with services configured`);

        for (const property of properties) {
            console.log(`\n🏠 Checking: ${property.name}`);

            // 1. Check Gas (Metrogas for CABA, Naturgy for PROVINCIA)
            if (property.gasId) {
                const isCABA = property.jurisdiction === 'CABA';
                const gasProvider = isCABA ? 'Metrogas' : 'Naturgy';
                console.log(`🔥 Checking ${gasProvider} (${property.gasId})...`);

                try {
                    const result = isCABA
                        ? await checkMetrogas(property.gasId)
                        : await checkNaturgy(property.gasId);

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

                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: gasProvider,
                        status: result.status,
                        debtAmount: result.debtAmount,
                        error: result.errorMessage
                    });

                    console.log(`   ✅ ${gasProvider}: ${result.status}${result.debtAmount > 0 ? ` - Debt: $${result.debtAmount}` : ''}`);
                } catch (error: any) {
                    console.error(`   ❌ ${gasProvider} Error: ${error.message}`);
                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: gasProvider,
                        status: 'ERROR',
                        debtAmount: 0,
                        error: error.message
                    });
                }
            }

            // 2. Check Electricity (Edenor)
            if (property.electricityId) {
                console.log(`⚡ Checking Edenor (${property.electricityId})...`);

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

                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: 'Edenor',
                        status: result.status,
                        debtAmount: result.debtAmount,
                        error: result.errorMessage
                    });

                    console.log(`   ✅ Edenor: ${result.status}${result.debtAmount > 0 ? ` - Debt: $${result.debtAmount}` : ''}`);
                } catch (error: any) {
                    console.error(`   ❌ Edenor Error: ${error.message}`);
                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: 'Edenor',
                        status: 'ERROR',
                        debtAmount: 0,
                        error: error.message
                    });
                }
            }

            // 3. Check ABL (Municipal) - Jurisdiction Aware
            if (property.municipalId) {
                const isCABA = property.jurisdiction === 'CABA';
                const serviceLabel = isCABA ? 'ABL CABA' : 'ABL Provincia';
                console.log(`🏛️  Checking ${serviceLabel} (${property.municipalId})...`);

                try {
                    const result = isCABA
                        ? await checkABLCABA(property.municipalId)
                        : await checkABLProvincia(property.municipalId);

                    await prisma.utilityCheck.create({
                        data: {
                            propertyId: property.id,
                            serviceType: 'ABL',
                            accountNumber: property.municipalId,
                            status: result.status,
                            debtAmount: result.debtAmount,
                            lastBillAmount: result.lastBillAmount,
                            lastBillDate: result.lastBillDate,
                            dueDate: result.dueDate,
                            isAutomatic: true,
                            errorMessage: result.errorMessage
                        }
                    });

                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: serviceLabel,
                        status: result.status,
                        debtAmount: result.debtAmount,
                        error: result.errorMessage
                    });

                    console.log(`   ✅ ${serviceLabel}: ${result.status}${result.debtAmount > 0 ? ` - Debt: $${result.debtAmount}` : ''}`);
                } catch (error: any) {
                    console.error(`   ❌ ${serviceLabel} Error: ${error.message}`);
                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: serviceLabel,
                        status: 'ERROR',
                        debtAmount: 0,
                        error: error.message
                    });
                }
            }
        }

        // Calculate summary
        const upToDate = results.filter(r => r.status === 'UP_TO_DATE').length;
        const overdue = results.filter(r => r.status === 'OVERDUE').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const unknown = results.filter(r => r.status === 'UNKNOWN').length;
        const totalDebt = results.reduce((sum, r) => sum + r.debtAmount, 0);

        console.log('\n📊 SUMMARY:');
        console.log(`   ✅ Up to date: ${upToDate}`);
        console.log(`   ⚠️  Overdue: ${overdue}`);
        console.log(`   ❓ Unknown: ${unknown}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   💰 Total debt: $${totalDebt.toLocaleString('es-AR')}`);

        return {
            upToDate,
            overdue,
            unknown,
            errors,
            totalDebt,
            results
        };

    } catch (error: any) {
        console.error('Utilities check error:', error);
        throw error;
    }
}
