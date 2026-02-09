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
            const frequency = contract.adjustmentFrequency;
            const limitDate = new Date(today);
            limitDate.setMonth(limitDate.getMonth() - frequency);

            const ipcValues = await prisma.economicIndicator.findMany({
                where: {
                    type: 'IPC',
                    date: { gte: limitDate, lt: today }
                },
                orderBy: { date: 'asc' }
            });

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
