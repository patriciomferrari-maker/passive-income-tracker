import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get ALL IPC data
    const ipcData = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' }
    });

    console.log('\n📊 ALL IPC Data in Database:\n');

    // Group by year-month
    const grouped = new Map<string, Array<{ id: string, date: Date, value: number }>>();

    ipcData.forEach(ipc => {
        const date = new Date(ipc.date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!grouped.has(yearMonth)) {
            grouped.set(yearMonth, []);
        }
        grouped.get(yearMonth)!.push({
            id: ipc.id,
            date: ipc.date,
            value: ipc.value
        });
    });

    // Display grouped data
    for (const [yearMonth, entries] of Array.from(grouped.entries()).sort()) {
        const isDuplicate = entries.length > 1;
        const marker = isDuplicate ? '⚠️ DUPLICADO' : '✓';

        console.log(`\n${marker} ${yearMonth} (${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'}):`);

        entries.forEach((entry, idx) => {
            const date = new Date(entry.date);
            const formatted = date.toISOString().split('T')[0];
            const localFormatted = date.toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            console.log(`  ${idx + 1}. ${formatted} (${localFormatted})`);
            console.log(`     Valor: ${entry.value}%`);
            console.log(`     ID: ${entry.id}`);
        });
    }

    console.log('\n---');
    console.log(`Total records: ${ipcData.length}`);

    const duplicateMonths = Array.from(grouped.entries()).filter(([_, entries]) => entries.length > 1);
    console.log(`Months with duplicates: ${duplicateMonths.length}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
