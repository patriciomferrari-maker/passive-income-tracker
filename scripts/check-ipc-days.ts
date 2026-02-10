import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📅 Verificando fechas de IPC (últimos 12 meses):\n');

    const ipcData = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'desc' },
        take: 12,
        select: { date: true, value: true }
    });

    ipcData.forEach(record => {
        const date = new Date(record.date);
        const day = date.getUTCDate();
        const month = date.getUTCMonth() + 1;
        const year = date.getUTCFullYear();

        const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        console.log(`${monthName}: Día ${day} - ${record.value}%`);
    });

    console.log('\n---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
