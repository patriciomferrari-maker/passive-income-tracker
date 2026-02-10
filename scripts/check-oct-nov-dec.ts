import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 IPCs de Octubre-Noviembre-Diciembre 2025\n');

    const ipcs = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2025, 9, 1),  // Oct 1
                lt: new Date(2026, 0, 1)    // Before Jan 1
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Total encontrados: ${ipcs.length}\n`);

    ipcs.forEach(ipc => {
        const date = new Date(ipc.date);
        console.log(`Mes JS: ${date.getMonth() + 1}/${date.getFullYear()}`);
        console.log(`  Fecha UTC: ${date.toISOString()}`);
        console.log(`  Valor: ${ipc.value}%`);
        console.log(`  Nombre del mes: ${date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`);
        console.log('');
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
