import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Investigación COMPLETA de IPC Enero 2026\n');

    // 1. Ver TODOS los IPC de los últimos 3 meses
    console.log('━━━ Todos los IPC desde Noviembre 2025 ━━━\n');

    const allRecent = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2025, 10, 1) // Nov 1, 2025
            }
        },
        orderBy: { date: 'desc' }
    });

    console.log(`Total encontrados: ${allRecent.length}\n`);

    allRecent.forEach((ipc, i) => {
        const date = new Date(ipc.date);
        const utcDate = new Date(ipc.date);
        console.log(`#${i + 1} ID: ${ipc.id}`);
        console.log(`   Fecha UTC: ${utcDate.toISOString()}`);
        console.log(`   Fecha Local AR: ${date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
        console.log(`   Mes extractado JS: ${date.getMonth() + 1}/${date.getFullYear()}`);
        console.log(`   Día UTC: ${utcDate.getUTCDate()}`);
        console.log(`   Valor: ${ipc.value}%`);
        console.log(`   Interanual: ${ipc.interannualValue ?? 'null'}`);
        console.log(`   isManual: ${ipc.isManual ?? 'null'}`);
        console.log(`   Created: ${new Date(ipc.createdAt).toLocaleString('es-AR')}`);
        console.log('');
    });

    console.log('\n---\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
