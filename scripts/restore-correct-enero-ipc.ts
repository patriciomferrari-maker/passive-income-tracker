import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔧 Restaurando IPC Enero 2026 correcto\n');

    // 1. Delete the incorrect 2.2% entry I created
    console.log('1. Borrando el 2.2% incorrecto creado por script...');
    const deleted = await prisma.economicIndicator.deleteMany({
        where: {
            type: 'IPC',
            value: 2.2,
            date: {
                gte: new Date(2026, 0, 1),
                lt: new Date(2026, 1, 1)
            }
        }
    });
    console.log(`   ✅ Eliminados: ${deleted.count} registro(s)\n`);

    // 2. Create the correct January 2026 entry with 2.9%
    console.log('2. Creando Enero 2026: 2.9% (valor correcto del usuario)...');

    // Use the EXACT same timezone logic as the bulk upload
    const eneroDate = new Date(2026, 0, 1); // Jan 1, 2026 local
    eneroDate.setUTCHours(12, 0, 0, 0); // Force noon UTC

    const created = await prisma.economicIndicator.create({
        data: {
            type: 'IPC',
            date: eneroDate,
            value: 2.9,
            interannualValue: null, // User didn't provide this
            isManual: true // User loaded it manually
        }
    });

    console.log(`   ✅ Creado: ID ${created.id}`);
    console.log(`   Fecha UTC: ${new Date(created.date).toISOString()}`);
    console.log(`   Valor: ${created.value}%\n`);

    // 3. Verify
    console.log('3. Verificando estado final...\n');
    const allJan = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2026, 0, 1),
                lt: new Date(2026, 1, 1)
            }
        }
    });

    console.log(`Total IPC de Enero 2026: ${allJan.length}`);
    allJan.forEach(ipc => {
        console.log(`  - ${ipc.value}% (${ipc.isManual ? 'Manual' : 'Auto'})`);
    });

    console.log('\n✅ Restauración completada!\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
