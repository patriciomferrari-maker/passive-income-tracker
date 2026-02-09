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
            console.log(`📌 ✅ Adjustment month for ${contract.property.name}: ${monthsPassed} months passed`);

            // Get the rent from the PREVIOUS adjustment period
            // For a quarterly adjustment in February, the last adjustment was in November (3 months ago)
            // NOT the most recent cashflow which might be from a future projected month
            const previousAdjustmentDate = new Date(today.getFullYear(), today.getMonth() - contract.adjustmentFrequency, 1);

            // Find the cashflow at or just before the previous adjustment
            const lastAdjustmentCashflow = await prisma.rentalCashflow.findFirst({
                where: {
                    contractId: contract.id,
                    date: { lte: previousAdjustmentDate }
                },
                orderBy: { date: 'desc' }
            });

            const lastRent = lastAdjustmentCashflow?.amountARS || contract.initialRent;

            console.log(`   Last rent (from ${previousAdjustmentDate.toLocaleDateString('es-AR')} or before): $${lastRent}`);

            // Fetch IPC values for the adjustment period
            // CRITICAL: Adjustment in February uses Nov-Dec-Jan IPC (the N PREVIOUS months)
            // Because January's IPC is published IN February, not before it
            // For a quarterly adjustment (frequency=3) in February:
            // - We need: November, December, January (the 3 months BEFORE February)
            // - NOT: December, January, February (February IPC doesn't exist yet in Feb)
            const frequency = contract.adjustmentFrequency;

            // Calculate the start: N months BEFORE current month
            // Examples:
            // - If in February (month 1) with quarterly (3): start = Feb - 3 = November
            // - If in May (month 4) with quarterly (3): start = May - 3 = February
            const startMonth = today.getMonth() - frequency;
            const startYear = today.getFullYear();

            // Get first day of start month
            const periodStart = new Date(startYear, startMonth, 1);

            // Get last day of PREVIOUS month (not current month, since current month's IPC isn't available yet)
            const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);

            console.log(`📅 IPC period for adjustment: ${periodStart.toLocaleDateString('es-AR')} to ${periodEnd.toLocaleDateString('es-AR')}`)

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

            console.log(`   Found ${ipcValues.length} IPC values for period:`);
            ipcValues.forEach(ipc => {
                const date = new Date(ipc.date);
                const formatted = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                console.log(`   - ${formatted}: ${ipc.value}%`);
            });

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
