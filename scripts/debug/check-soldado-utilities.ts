import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSoldadoUtilities() {
    console.log('🔍 Checking Soldado property and its utility checks...\n');

    // Find Soldado
    const soldado = await prisma.property.findFirst({
        where: {
            name: 'Soldado'
        },
        include: {
            user: {
                select: {
                    email: true,
                    name: true
                }
            }
        }
    });

    if (!soldado) {
        console.log('❌ Soldado property not found');
        return;
    }

    console.log('✅ Found Soldado property:');
    console.log(`   ID: ${soldado.id}`);
    console.log(`   Owner: ${soldado.user.email} (${soldado.user.name})`);
    console.log(`   Jurisdiction: ${soldado.jurisdiction}`);
    console.log(`   Gas ID: ${soldado.gasId}`);
    console.log(`   Electricity ID: ${soldado.electricityId}`);
    console.log('');

    // Check utility checks
    const checks = await prisma.utilityCheck.findMany({
        where: {
            propertyId: soldado.id
        },
        orderBy: {
            checkDate: 'desc'
        },
        take: 10
    });

    console.log(`📊 Found ${checks.length} utility checks:\n`);

    for (const check of checks) {
        console.log(`${check.serviceType} - ${check.status}`);
        console.log(`   Date: ${check.checkDate}`);
        console.log(`   Debt: $${check.debtAmount || 0}`);
        console.log(`   Auto: ${check.isAutomatic}`);
        if (check.errorMessage) {
            console.log(`   Error: ${check.errorMessage}`);
        }
        console.log('');
    }

    await prisma.$disconnect();
}

checkSoldadoUtilities()
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
