import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProperties() {
    console.log('🔍 Checking all properties in production...\n');

    const properties = await prisma.property.findMany({
        select: {
            id: true,
            name: true,
            jurisdiction: true,
            gasId: true,
            electricityId: true,
            userId: true
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log(`Found ${properties.length} properties:\n`);

    for (const prop of properties) {
        console.log(`📍 ${prop.name}`);
        console.log(`   User: ${prop.userId}`);
        console.log(`   Jurisdiction: ${prop.jurisdiction || 'NOT SET'}`);
        console.log(`   Gas ID: ${prop.gasId || 'NOT SET'}`);
        console.log(`   Electricity ID: ${prop.electricityId || 'NOT SET'}`);
        console.log('');
    }

    // Check for Soldado specifically
    const soldado = properties.find(p => p.name.toLowerCase().includes('soldado'));
    if (soldado) {
        console.log('✅ Found Soldado property');
    } else {
        console.log('❌ Soldado property NOT FOUND');
    }

    await prisma.$disconnect();
}

checkProperties()
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
