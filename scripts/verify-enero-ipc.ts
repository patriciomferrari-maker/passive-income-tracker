import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📊 Verificando IPC de Enero 2026 en DB:\n');

    const eneroIPCs = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2026, 0, 1),  // Jan 1, 2026
                lt: new Date(2026, 1, 1)    // Before Feb 1, 2026
            }
        },
        orderBy: { date: 'asc' }
    });

    if (eneroIPCs.length === 0) {
        console.log('❌ NO hay IPC de enero 2026 en la base de datos\n');
        console.log('Esto explica por qué no llegó el email.\n');
        console.log('💡 Necesitas cargar el IPC de enero 2026 desde el Admin.');
        console.log('   Valor real según INDEC: 2.2% mensual\n');
        return;
    }

    console.log(`Encontrados: ${eneroIPCs.length} registro(s)\n`);

    eneroIPCs.forEach((ipc, index) => {
        const date = new Date(ipc.date);
        console.log(`Registro ${index + 1}:`);
        console.log(`  ID: ${ipc.id}`);
        console.log(`  Fecha completa: ${date.toISOString()}`);
        console.log(`  Fecha local: ${date.toLocaleDateString('es-AR')}`);
        console.log(`  Día del mes: ${date.getDate()}`);
        console.log(`  Valor mensual: ${ipc.value}%`);
        console.log(`  Valor interanual: ${ipc.interannualValue || '-'}%`);
        console.log('');
    });

    // Ahora verificar últimos 3 meses de IPC
    console.log('\n📅 Últimos 3 meses de IPC:\n');

    const lastThree = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'desc' },
        take: 3
    });

    lastThree.forEach(ipc => {
        const date = new Date(ipc.date);
        const monthYear = date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
        console.log(`${monthYear}: ${ipc.value}%${ipc.interannualValue ? ` (Interanual: ${ipc.interannualValue}%)` : ''}`);
    });

    console.log('\n---\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
