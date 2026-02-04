import { prisma } from '@/lib/prisma';
import { sendContractAdjustmentAlert } from './email-service';

export async function checkContractAdjustments() {
    console.log('🔍 Checking for contract adjustments...');

    // 1. Fetch active contracts with IPC adjustment
    const contracts = await prisma.contract.findMany({
        where: {
            adjustmentType: 'IPC',
            // active? No strict 'active' field, infer from endDate or duration
        },
        include: {
            property: true,
            rentalCashflows: {
                orderBy: { date: 'desc' },
                take: 1
            }
        }
    });

    const today = new Date();

    for (const contract of contracts) {
        // Calculate strict dates
        const startDate = new Date(contract.startDate);
        const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());

        // Check if this month is an adjustment month (e.g. Month 6, 12, 18...)
        if (monthsPassed > 0 && monthsPassed % contract.adjustmentFrequency === 0) {
            // It's adjustment time!

            // Check if we already handled this? (e.g. check if latest cashflow is from this month/period updated)
            // Or simpler: Check if we have the IPC data to calculate it.

            // We need IPC from (Today - Frequency) to (Today - 1 or 2 months depending on publication)
            // Simplified Logic: 
            // 1. Get latest Rent (from last Cashflow or Initial)
            const lastRent = contract.rentalCashflows[0]?.amountARS || contract.initialRent;

            // 2. Fetch IPC Interannual or Cumulative
            // Assume we want "Variacion acumulada ultimos X meses"
            // Fetch IPCs
            const frequency = contract.adjustmentFrequency;
            const limitDate = new Date(today);
            limitDate.setMonth(limitDate.getMonth() - frequency);

            // Get sum of IPC variations? Or product? 
            // IPC is usually (IndexNow / IndexStart) - 1.
            // Let's use stored Indices if possible, or sum monthly variations if that's what we have.
            // Our EconomicIndicator stores 'value' as monthly variation usually.

            // Fetch indices for precise calculation
            // This is complex without a proper Index series table, but let's assume we have EconomicIndicator(IPC)
            // logic: NewRent = OldRent * (LatestIndex / BaseIndex)

            // For MVP, I will send a generic alert "Check this contract" if data is missing, 
            // or try to calc if data exists.

            const ipcValues = await prisma.economicIndicator.findMany({
                where: {
                    type: 'IPC',
                    date: { gte: limitDate, lt: today }
                },
                orderBy: { date: 'asc' }
            });

            if (ipcValues.length === 0) continue; // No data yet

            // Calculate accumulated inflation roughly
            // Product of (1 + rate)
            let accumulator = 1.0;
            ipcValues.forEach(ipc => {
                accumulator *= (1 + (ipc.value / 100));
            });

            const newRent = Math.round(lastRent * accumulator);
            const percentage = ((accumulator - 1) * 100).toFixed(1);

            // Send Alert
            await sendContractAdjustmentAlert({
                propertyName: contract.property.name,
                tenantName: contract.tenantName || 'Inquilino',
                oldRent: lastRent,
                newRent: newRent,
                percentage: percentage,
                adjustmentDate: today.toLocaleDateString()
            });
        }
    }
}
