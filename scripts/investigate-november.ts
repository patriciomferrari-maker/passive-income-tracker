import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Investigando Noviembre 2025\n');

    // Find ALL IPCs that might be November
    const allNov = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            OR: [
                { value: 2.5 },
                { value: 2.8 },
            ],
            date: {
                gte: new Date(2025, 9, 1),  // Oct 1
                lt: new Date(2026, 0, 1)    // Before Jan 1
            }
        },
        orderBy: { date: 'asc' }
    });

    console.log(`Total IPCs con valor 2.5% o 2.8%: ${allNov.length}\n`);

    allNov.forEach(ipc => {
        const date = new Date(ipc.date);
        const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        console.log(`ID: ${ipc.id}`);
        console.log(`  Valor: ${ipc.value}%`);
        console.log(`  Fecha UTC: ${date.toISOString()}`);
        console.log(`  Mes JS (getMonth): ${date.getMonth()}`);
        console.log(`  Nombre del mes: ${monthName}`);
        console.log(`  isManual: ${ipc.isManual}`);
        console.log(`  Created: ${new Date(ipc.createdAt).toLocaleString('es-AR')}`);
        console.log('');
    });

    console.log('---\n');
    console.log('Pregunta: ¿Cuál es el VALOR CORRECTO de Noviembre 2025?');
    console.log('Opciones: 2.5% o 2.8%?\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
