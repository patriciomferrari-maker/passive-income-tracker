import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Simulate what the contract-helper does
    const today = new Date();
    const frequency = 3; // quarterly

    console.log('\n📅 Period Calculation:');
    console.log(`Today: ${today.toLocaleDateString('es-AR')}`);
    console.log(`Frequency: ${frequency} months`);

    // CORRECTED: Use frequency (not frequency-1) and end on last month (not current month)
    const startMonth = today.getMonth() - frequency;
    const startYear = today.getFullYear();
    const periodStart = new Date(startYear, startMonth, 1);
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of PREVIOUS month

    console.log(`Period Start: ${periodStart.toLocaleDateString('es-AR')}`);
    console.log(`Period End: ${periodEnd.toLocaleDateString('es-AR')}`);

    // Run the DISTINCT query
    const ipcValues = await prisma.$queryRaw<Array<{ date: Date, value: number }>>`
        SELECT DISTINCT ON (EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date))
            date, value
        FROM "EconomicIndicator"
        WHERE type = 'IPC'
            AND date >= ${periodStart}::date
            AND date <= ${periodEnd}::date
        ORDER BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date), date DESC
    `;

    console.log('\n📊 Query Results:\n');
    ipcValues.forEach(ipc => {
        const date = new Date(ipc.date);
        const formatted = date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        console.log(`${formatted}: ${ipc.value}%`);
    });

    console.log(`\nTotal: ${ipcValues.length} values`);

    // Calculate accumulated
    let accumulated = 1;
    ipcValues.forEach(ipc => {
        accumulated *= (1 + ipc.value / 100);
    });
    const percentageAccumulated = ((accumulated - 1) * 100).toFixed(2);
    console.log(`\nAccumulated: ${percentageAccumulated}%`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
