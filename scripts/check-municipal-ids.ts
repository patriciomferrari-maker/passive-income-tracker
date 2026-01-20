import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProperties() {
    const properties = await prisma.property.findMany({
        select: {
            name: true,
            jurisdiction: true,
            municipalId: true,
            hasGarage: true,
            garageMunicipalId: true
        },
        orderBy: {
            name: 'asc'
        }
    });

    console.log('📋 Propiedades con Municipal IDs:\n');

    for (const prop of properties) {
        console.log(`📍 ${prop.name} (${prop.jurisdiction})`);
        console.log(`   Municipal ID: ${prop.municipalId || 'NO CONFIGURADO'}`);
        if (prop.hasGarage) {
            console.log(`   Garage Municipal ID: ${prop.garageMunicipalId || 'NO CONFIGURADO'}`);
        }
        console.log('');
    }

    await prisma.$disconnect();
}

checkProperties();
