import { prisma } from '../lib/prisma';
import { checkMetrogas } from '../lib/scrapers/metrogas';
import { checkAysaWeb } from '../lib/scrapers/aysa-web';
import { checkNaturgy } from '../lib/scrapers/naturgy';

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
                    { aysaId: { not: null } }
                ]
            },
            select: {
                id: true,
                name: true,
                gasId: true,
                aysaId: true,
                municipalId: true,
                jurisdiction: true
            }
        });

        console.log(`📋 Found ${properties.length} properties with services configured\n`);

        for (const property of properties) {
            console.log(`\n🏠 Checking: ${property.name}`);
            console.log('─'.repeat(50));

            // Check Metrogas (Gas) - SCAPER METHOD (Legacy/Working)
            if (property.gasId) {
                console.log(`\n🔥 Checking Metrogas (${property.gasId})...`);
                try {
                    const result = await checkMetrogas(property.gasId);

                    // Save to database
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
                        service: 'Metrogas',
                        status: result.status,
                        debtAmount: result.debtAmount,
                        error: result.errorMessage
                    });

                    console.log(`   ✅ Status: ${result.status}`);
                    if (result.debtAmount > 0) {
                        console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                    }
                } catch (error: any) {
                    console.error(`   ❌ Error: ${error.message}`);
                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: 'Metrogas',
                        status: 'ERROR',
                        debtAmount: 0,
                        error: error.message
                    });
                }

                // Check Naturgy (Gas) - Run for same ID, assuming it might be Naturgy if Metrogas fails or just to support both
                console.log(`\n🔥 Checking Naturgy (${property.gasId})...`);
                try {
                    const result = await checkNaturgy(property.gasId);

                    // Only save if status is known/valid to avoid cluttering DB with "User not found" from wrong provider
                    if (result.status !== 'UNKNOWN' && result.status !== 'ERROR') {
                        await prisma.utilityCheck.create({
                            data: {
                                propertyId: property.id,
                                serviceType: 'GAS', // Uses same type 'GAS'
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
                            service: 'Naturgy',
                            status: result.status,
                            debtAmount: result.debtAmount,
                            error: result.errorMessage
                        });

                        console.log(`   ✅ Status: ${result.status}`);
                        if (result.debtAmount > 0) {
                            console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                        }
                    } else {
                        console.log(`   ℹ️  Skipping Naturgy result: ${result.status} (likely not a Naturgy account)`);
                    }

                } catch (error: any) {
                    // Don't error out loudly, just log
                    console.error(`   ❌ Naturgy Error: ${error.message}`);
                }
            }

            // Check ABL (Municipal) - NEW RAPIPAGO SCRAPER
            if (property.municipalId) {
                console.log(`\n🏛️ Checking ABL CABA (${property.municipalId})...`);
                try {
                    // Lazy load to avoid issues if module has missing deps
                    const { checkABLRapipago } = require('../lib/scrapers/abl-rapipago');
                    const result = await checkABLRapipago(property.municipalId);

                    // Save to database
                    if (result.status !== 'UNKNOWN' && result.status !== 'ERROR') {
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
                            service: 'ABL',
                            status: result.status,
                            debtAmount: result.debtAmount,
                            error: result.errorMessage
                        });

                        console.log(`   ✅ Status: ${result.status}`);
                        if (result.debtAmount > 0) {
                            console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                        }
                    } else if (result.status === 'ERROR') {
                        console.error(`   ❌ ABL Error: ${result.errorMessage}`);
                        results.push({
                            propertyId: property.id,
                            propertyName: property.name,
                            service: 'ABL',
                            status: 'ERROR',
                            debtAmount: 0,
                            error: result.errorMessage
                        });
                    }

                } catch (error: any) {
                    console.error(`   ❌ Error loading/running ABL scraper: ${error.message}`);
                }
            }

            // Check AYSA (Water) - WEB SCRAPER METHOD
            if (property.aysaId) {
                console.log(`\n💧 Checking AYSA (${property.aysaId})...`);
                try {
                    const result = await checkAysaWeb(property.aysaId);

                    // Save to database
                    await prisma.utilityCheck.create({
                        data: {
                            propertyId: property.id,
                            serviceType: 'AYSA',
                            accountNumber: property.aysaId,
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
                        service: 'AYSA',
                        status: result.status,
                        debtAmount: result.debtAmount,
                        error: result.errorMessage
                    });

                    console.log(`   ✅ Status: ${result.status}`);
                    if (result.debtAmount > 0) {
                        console.log(`   💰 Debt: $${result.debtAmount.toLocaleString('es-AR')}`);
                    }
                } catch (error: any) {
                    console.error(`   ❌ Error: ${error.message}`);
                    results.push({
                        propertyId: property.id,
                        propertyName: property.name,
                        service: 'AYSA',
                        status: 'ERROR',
                        debtAmount: 0,
                        error: error.message
                    });
                }
            }
        }

        // Summary
        console.log('\n\n' + '='.repeat(50));
        console.log('📊 SUMMARY');
        console.log('='.repeat(50));

        const upToDate = results.filter(r => r.status === 'UP_TO_DATE').length;
        const overdue = results.filter(r => r.status === 'OVERDUE').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const totalDebt = results.reduce((sum, r) => sum + r.debtAmount, 0);

        console.log(`\n✅ Up to date: ${upToDate}`);
        console.log(`⚠️  Overdue: ${overdue}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`💰 Total debt: $${totalDebt.toLocaleString('es-AR')}`);

        if (overdue > 0) {
            console.log('\n⚠️  PROPERTIES WITH DEBT:');
            results.filter(r => r.status === 'OVERDUE').forEach(r => {
                console.log(`   • ${r.propertyName} - ${r.service}: $${r.debtAmount.toLocaleString('es-AR')}`);
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
