import { prisma } from '@/lib/prisma';
import { sendContractAdjustmentAlert } from './email-service';

export async function checkContractAdjustments() {
    console.log('🔍 Checking for contract adjustments...');

    // 1. Fetch active contracts with IPC adjustment
    const contracts = await prisma.contract.findMany({
        where: {
            adjustmentType: 'IPC',
        },
        include: {
            property: {
                include: {
                    user: true
                }
            },
            rentalCashflows: {
                orderBy: { date: 'desc' },
                take: 1
            }
        }
    });

    const today = new Date();

    for (const contract of contracts) {
        // Calculate months since start
        const startDate = new Date(contract.startDate);
        const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());

        // Check if this month is an adjustment month (e.g. Month 3, 6, 9, 12...)
        if (monthsPassed > 0 && monthsPassed % contract.adjustmentFrequency === 0) {
            console.log(`📌 Adjustment month for ${contract.property.name}: ${monthsPassed} months passed`);

            // Get latest rent
            const lastRent = contract.rentalCashflows[0]?.amountARS || contract.initialRent;

            // Fetch IPC values for the adjustment period
            // For a quarterly adjustment (frequency=3) in February:
            // - We need the PREVIOUS 3 months: December, January, February
            // - NOT: November, December, January
            const frequency = contract.adjustmentFrequency;

            // Calculate the start month: (frequency - 1) months AGO
            // Examples:
            // - If in February (month 1) with quarterly (3): start = Feb - (3-1) = Feb - 2 = December
            // - If in May (month 4) with quarterly (3): start = May - 2 = March
            const startMonth = today.getMonth() - (frequency - 1);
            const startYear = today.getFullYear();

            // Get first day of start month
            const periodStart = new Date(startYear, startMonth, 1);

            // Get last day of current month
            const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

            console.log(`📅 Adjustment period: ${periodStart.toLocaleDateString('es-AR')} to ${periodEnd.toLocaleDateString('es-AR')}`);

            // Fetch IPC values - use DISTINCT on year-month to avoid duplicates
            const ipcValues = await prisma.$queryRaw<Array<{ date: Date, value: number }>>`
                SELECT DISTINCT ON (EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date))
                    date, value
                FROM "EconomicIndicator"
                WHERE type = 'IPC'
                    AND date >= ${periodStart}::date
                    AND date <= ${periodEnd}::date
                ORDER BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date), date DESC
            `;

            if (ipcValues.length === 0) {
                console.log(`⏳ No IPC data yet for ${contract.property.name}`);
                continue;
            }

            // Build monthly IPC data with formatted month names
            const ipcMonths = ipcValues.map(ipc => {
                const date = new Date(ipc.date);
                const monthName = new Intl.DateTimeFormat('es-AR', {
                    month: 'long',
                    year: 'numeric'
                }).format(date);

                // Capitalize first letter
                const formatted = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                return {
                    month: formatted,
                    value: ipc.value
                };
            });

            // Calculate accumulated inflation
            let accumulator = 1.0;
            ipcValues.forEach(ipc => {
                accumulator *= (1 + (ipc.value / 100));
            });

            const newRent = Math.round(lastRent * accumulator);
            const percentage = ((accumulator - 1) * 100).toFixed(2);

            console.log(`📊 ${contract.property.name}: ${lastRent} → ${newRent} (+${percentage}%)`);

            // Send Alert
            await sendContractAdjustmentAlert({
                propertyName: contract.property.name,
                tenantName: contract.tenantName || 'Inquilino',
                oldRent: lastRent,
                newRent: newRent,
                percentage: percentage,
                adjustmentDate: today.toLocaleDateString('es-AR'),
                ipcMonths: ipcMonths,
                ownerEmail: contract.property.user.email
            });
        }
    }
}
