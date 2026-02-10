import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get ALL IPC data
    const ipcData = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'desc' },
        take: 20 // Last 20 records
    });

    console.log('\n📊 Last 20 IPC records with interannual values:\n');

    let withInterannual = 0;
    let withoutInterannual = 0;

    ipcData.forEach(ipc => {
        const date = new Date(ipc.date);
        const formatted = date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long'
        });

        const hasInterannual = ipc.interannualValue !== null && ipc.interannualValue !== undefined;
        if (hasInterannual) {
            withInterannual++;
            console.log(`✅ ${formatted}: ${ipc.value}% mensual, ${ipc.interannualValue}% interanual`);
        } else {
            withoutInterannual++;
            console.log(`❌ ${formatted}: ${ipc.value}% mensual, SIN valor interanual`);
        }
    });

    console.log('\n---');
    console.log(`Con valor interanual: ${withInterannual}`);
    console.log(`Sin valor interanual: ${withoutInterannual}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
