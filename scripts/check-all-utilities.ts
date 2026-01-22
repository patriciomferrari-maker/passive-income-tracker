import { prisma } from '../lib/prisma';
import { checkMetrogasWhatsApp } from '../lib/scrapers/metrogas-whatsapp';
import { checkAysaWhatsApp } from '../lib/scrapers/aysa-whatsapp';

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
                jurisdiction: true
            }
        });

        console.log(`📋 Found ${properties.length} properties with services configured\n`);

        for (const property of properties) {
            console.log(`\n🏠 Checking: ${property.name}`);
            console.log('─'.repeat(50));

            // Check Metrogas (Gas)
            if (property.gasId) {
                console.log(`\n🔥 Checking Metrogas (${property.gasId})...`);
                try {
                    const result = await checkMetrogasWhatsApp(property.gasId);

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
            }

            // Check AYSA (Water)
            if (property.aysaId) {
                console.log(`\n💧 Checking AYSA (${property.aysaId})...`);
                try {
                    const result = await checkAysaWhatsApp(property.aysaId);

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
