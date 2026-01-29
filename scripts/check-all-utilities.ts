import { prisma } from '../lib/prisma';
import { checkMetrogas } from '../lib/scrapers/metrogas';
import { checkAysaWeb } from '../lib/scrapers/aysa-web';
import { checkABLCABA } from '../lib/scrapers/abl-caba';
import { checkABLProvincia } from '../lib/scrapers/abl-provincia';
import { checkNaturgyRapipago as checkNaturgy } from '../lib/scrapers/naturgy-rapipago';
import { checkEdenor } from '../lib/scrapers/edenor';

interface CheckResult {
    propertyId: string;
    propertyName: string;
    service: string;
    status: string;
    debtAmount: number;
    error?: string;
}

async function checkAllUtilities() {
    console.log('🔍 Starting automated utilities check...\n');
    console.log(`⏰ ${new Date().toLocaleString('es-AR')}\n`);

    const results: CheckResult[] = [];

    try {
        // Get all properties with utility IDs
        const properties = await prisma.property.findMany({
            where: {
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

        console.log(`📋 Found ${properties.length} properties with services configured\n`);

        for (const property of properties) {
            console.log(`\n🏠 Checking: ${property.name}`);
            console.log('─'.repeat(50));

            // 1. Check Gas (Metrogas for CABA, Naturgy for PROVINCIA)
            if (property.gasId) {
                const isCABA = property.jurisdiction === 'CABA';
                const gasProvider = isCABA ? 'Metrogas' : 'Naturgy';
                console.log(`\n🔥 Checking ${gasProvider} (${property.gasId})...`);
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

                    console.log(`   ✅ Status: ${result.status}`);
                    if (result.debtAmount > 0) {
                        console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                    }
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

            // 2. Check Edenor (Electricity)
            if (property.electricityId) {
                console.log(`\n⚡ Checking Edenor (${property.electricityId})...`);
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

                    console.log(`   ✅ Status: ${result.status}`);
                    if (result.debtAmount > 0) {
                        console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                    }
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

            // 2. Check ABL (Municipal) - Jurisdiction Aware
            if (property.municipalId) {
                const isCABA = property.jurisdiction === 'CABA';
                const serviceLabel = isCABA ? 'ABL CABA' : 'ABL Provincia';
                console.log(`\n🏛️  Checking ${serviceLabel} (${property.municipalId})...`);

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

                    console.log(`   ✅ Status: ${result.status}${result.status !== 'UP_TO_DATE' && result.status !== 'OVERDUE' ? ` (${result.errorMessage || ''})` : ''}`);
                    if (result.debtAmount > 0) {
                        console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                    }

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

            // 4. (Removed) Check AYSA (Water) - As per user request focus list
        }

        // Summary
        console.log('\n\n' + '='.repeat(50));
        console.log('📊 SUMMARY');
        console.log('='.repeat(50));

        const upToDate = results.filter(r => r.status === 'UP_TO_DATE').length;
        const overdue = results.filter(r => r.status === 'OVERDUE').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const unknown = results.filter(r => r.status === 'UNKNOWN').length;
        const totalDebt = results.reduce((sum, r) => sum + r.debtAmount, 0);

        console.log(`\n✅ Up to date: ${upToDate}`);
        console.log(`⚠️  Overdue: ${overdue}`);
        console.log(`❓ Unknown/Blocked: ${unknown}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`💰 Total debt: $${totalDebt.toLocaleString('es-AR')}`);

        if (overdue > 0) {
            console.log('\n⚠️  PROPERTIES WITH DEBT:');
            results.filter(r => r.status === 'OVERDUE').forEach(r => {
                console.log(`   • ${r.propertyName} - ${r.service}: $${r.debtAmount.toLocaleString('es-AR')}`);
            });
        }

        const blocked = results.filter(r => r.status === 'ERROR' || r.status === 'UNKNOWN');
        if (blocked.length > 0) {
            console.log('\n🚫 BLOCKED OR ERROR SERVICES (RE-RUN RECOMMENDED):');
            blocked.forEach(r => {
                console.log(`   • ${r.propertyName} - ${r.service}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
            });
        }

        console.log('\n✅ Check completed successfully!\n');

    } catch (error: any) {
        console.error('\n❌ Fatal error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the check
checkAllUtilities()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
