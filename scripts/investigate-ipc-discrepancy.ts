import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Investigación completa de IPC Enero 2026\n');

    // 1. Buscar TODOS los IPC de enero 2026
    console.log('━━━ IPC de Enero 2026 (todos) ━━━\n');

    const eneroAll = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2026, 0, 1),
                lt: new Date(2026, 1, 1)
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Total encontrados: ${eneroAll.length}\n`);

    eneroAll.forEach((ipc, i) => {
        const date = new Date(ipc.date);
        console.log(`#${i + 1} ID: ${ipc.id}`);
        console.log(`   Fecha: ${date.toISOString()}`);
        console.log(`   Día: ${date.getDate()}`);
        console.log(`   Valor: ${ipc.value}%`);
        console.log(`   Interanual: ${ipc.interannualValue ?? 'null'}`);
        console.log('');
    });

    // 2. Buscar IPC con valor 2.2%
    console.log('\n━━━ IPC con valor 2.2% ━━━\n');

    const ipc22 = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            value: 2.2
        },
        orderBy: { date: 'desc' }
    });

    console.log(`Total con 2.2%: ${ipc22.length}\n`);

    ipc22.forEach((ipc) => {
        const date = new Date(ipc.date);
        const monthYear = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        console.log(`${monthYear}: ${ipc.value}% (ID: ${ipc.id})`);
    });

    // 3. Buscar IPC con valor 2.9%
    console.log('\n━━━ IPC con valor 2.9% ━━━\n');

    const ipc29 = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            value: 2.9
        },
        orderBy: { date: 'desc' }
    });

    console.log(`Total con 2.9%: ${ipc29.length}\n`);

    ipc29.forEach((ipc) => {
        const date = new Date(ipc.date);
        const monthYear = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        console.log(`${monthYear}: ${ipc.value}% (ID: ${ipc.id})`);
    });

    // 4. Últimos 5 IPC
    console.log('\n━━━ Últimos 5 IPC en orden cronológico ━━━\n');

    const last5 = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'desc' },
        take: 5
    });

    last5.forEach((ipc, i) => {
        const date = new Date(ipc.date);
        const monthYear = date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
        console.log(`${i + 1}. ${monthYear}: ${ipc.value}%`);
    });

    console.log('\n---\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
