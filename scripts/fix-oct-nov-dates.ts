import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔧 Arreglando fechas de IPC Octubre y Noviembre 2025\n');

    // 1. October 2025 - Currently stored as Nov 1, should be Oct 1
    console.log('1. Arreglando Octubre 2025...');
    const octoberIPC = await prisma.economicIndicator.findFirst({
        where: {
            type: 'IPC',
            value: 2.5,
            date: {
                gte: new Date(Date.UTC(2025, 10, 1, 0, 0, 0)), // Nov 1 UTC
                lt: new Date(Date.UTC(2025, 10, 2, 0, 0, 0))   // Nov 2 UTC
            }
        }
    });

    if (octoberIPC) {
        console.log(`   Encontrado: ID ${octoberIPC.id}`);
        console.log(`   Fecha actual: ${new Date(octoberIPC.date).toISOString()}`);

        // Update to October 1 at noon UTC
        await prisma.economicIndicator.update({
            where: { id: octoberIPC.id },
            data: {
                date: new Date(Date.UTC(2025, 9, 1, 12, 0, 0)) // Oct 1, 2025 at noon UTC
            }
        });

        console.log(`   Nueva fecha: ${new Date(Date.UTC(2025, 9, 1, 12, 0, 0)).toISOString()}`);
        console.log(`   ✅ Actualizado\n`);
    } else {
        console.log(`   ⚠️  No encontrado\n`);
    }

    // 2. November 2025 - Currently stored as Dec 1, should be Nov 1
    console.log('2. Arreglando Noviembre 2025...');
    const novemberIPC = await prisma.economicIndicator.findFirst({
        where: {
            type: 'IPC',
            value: 2.8,
            date: {
                gte: new Date(Date.UTC(2025, 11, 1, 0, 0, 0)), // Dec 1 UTC
                lt: new Date(Date.UTC(2025, 11, 2, 0, 0, 0))   // Dec 2 UTC
            }
        }
    });

    if (novemberIPC) {
        console.log(`   Encontrado: ID ${novemberIPC.id}`);
        console.log(`   Fecha actual: ${new Date(novemberIPC.date).toISOString()}`);

        // Update to November 1 at noon UTC
        await prisma.economicIndicator.update({
            where: { id: novemberIPC.id },
            data: {
                date: new Date(Date.UTC(2025, 10, 1, 12, 0, 0)) // Nov 1, 2025 at noon UTC
            }
        });

        console.log(`   Nueva fecha: ${new Date(Date.UTC(2025, 10, 1, 12, 0, 0)).toISOString()}`);
        console.log(`   ✅ Actualizado\n`);
    } else {
        console.log(`   ⚠️  No encontrado\n`);
    }

    // 3. Verify
    console.log('3. Verificando estado final...\n');
    const allFinal = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2025, 9, 1),  // Oct 1
                lt: new Date(2026, 1, 1)    // Before Feb 1
            }
        },
        orderBy: { date: 'asc' }
    });

    allFinal.forEach(ipc => {
        const date = new Date(ipc.date);
        const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        console.log(`${monthName}: ${ipc.value}% (${date.toISOString()})`);
    });

    console.log('\n✅ Corrección completada!\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
