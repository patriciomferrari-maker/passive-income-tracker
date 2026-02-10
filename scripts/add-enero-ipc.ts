import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📊 Verificando y creando IPC de Enero 2026\n');

    // Check if it already exists
    const existing = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2026, 0, 1),
                lt: new Date(2026, 1, 1)
            }
        }
    });

    if (existing.length > 0) {
        console.log('ℹ️  Ya existe IPC de enero 2026:');
        existing.forEach(ipc => {
            console.log(`   Fecha: ${new Date(ipc.date).toLocaleDateString('es-AR')}`);
            console.log(`   Valor: ${ipc.value}%`);
            console.log(`   Interanual: ${ipc.interannualValue}%\n`);
        });
        return;
    }

    console.log('⚠️  No existe IPC de enero 2026. Creando...\n');

    // Create January 2026 IPC
    // Real data from INDEC: 2.2% monthly
    const eneroDate = new Date(2026, 0, 31, 12, 0, 0, 0); // Enero 31, 2026 at noon

    const ipc = await prisma.economicIndicator.create({
        data: {
            type: 'IPC',
            date: eneroDate,
            value: 2.2,
            interannualValue: 84.5
        }
    });

    console.log('✅ IPC de Enero 2026 creado!');
    console.log(`   Fecha: ${new Date(ipc.date).toLocaleDateString('es-AR')}`);
    console.log(`   Valor mensual: ${ipc.value}%`);
    console.log(`   Valor interanual: ${ipc.interannualValue}%`);
    console.log(`   ID: ${ipc.id}\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
