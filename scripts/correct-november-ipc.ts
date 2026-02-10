import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔧 Corrigiendo valor de IPC Noviembre 2025\n');

    // Find November 2025 entry (should hold 2.8% currently)
    const novemberIPC = await prisma.economicIndicator.findFirst({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(Date.UTC(2025, 10, 1, 0, 0, 0)), // Nov 1 UTC
                lt: new Date(Date.UTC(2025, 10, 2, 0, 0, 0))   // Nov 2 UTC
            }
        }
    });

    if (novemberIPC) {
        console.log(`   Encontrado Noviembre 2025: ID ${novemberIPC.id}`);
        console.log(`   Valor actual: ${novemberIPC.value}%`);

        // Update to 2.5%
        await prisma.economicIndicator.update({
            where: { id: novemberIPC.id },
            data: {
                value: 2.5,
                isManual: true // Mark as manual to prevent accidental overwrite if scraper runs again with wrong data
            }
        });

        console.log(`   ✅ Actualizado a: 2.5%`);
    } else {
        console.log(`   ❌ ERROR: No se encontró IPC de Noviembre 2025`);
    }

    console.log('\n✅ Corrección completada!\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
