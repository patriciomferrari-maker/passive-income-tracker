import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // 1. Fetch Contract to get start date and currency
        const contract = await prisma.contract.findUnique({
            where: { id },
            select: {
                startDate: true,
                currency: true
            }
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        // 2. Fetch Cashflows
        const cashflows = await prisma.rentalCashflow.findMany({
            where: { contractId: id },
            orderBy: { date: 'asc' }
        });

        // 3. If ARS contract, perform USD calculations & IPC Adjustments
        if (contract.currency === 'ARS' && cashflows.length > 0) {
            // Determine date range for rates: 1 month before start date -> last cashflow date
            const startDate = new Date(contract.startDate);
            const firstDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth() - 1, 1));

            const lastCashflowDate = new Date(cashflows[cashflows.length - 1].date);
            const lastDate = new Date(lastCashflowDate);
            lastDate.setMonth(lastDate.getMonth() + 1);

            // Fetch Contract details needed for adjustment
            const fullContract = await prisma.contract.findUnique({
                where: { id },
                select: {
                    initialRent: true,
                    adjustmentFrequency: true,
                    adjustmentType: true
                }
            });

            // Fetch Rates
            const [ratesTC, ratesIPC] = await Promise.all([
                prisma.economicIndicator.findMany({
                    where: {
                        type: 'TC_USD_ARS',
                        date: { gte: firstDate, lte: lastDate }
                    },
                    orderBy: { date: 'asc' },
                    select: { date: true, value: true }
                }),
                prisma.economicIndicator.findMany({
                    where: {
                        type: 'IPC',
                        date: { gte: firstDate, lte: lastDate }
                    },
                    orderBy: { date: 'asc' },
                    select: { date: true, value: true }
                })
            ]);

            // Latest logic to prevent future projection
            const maxTCDate = ratesTC.length > 0 ? new Date(ratesTC[ratesTC.length - 1].date) : new Date(0);

            // Helpers
            const getClosestRate = (targetDate: Date, dataset: { date: Date, value: number }[]) => {
                let bestRate = null;
                for (const item of dataset) {
                    if (item.date <= targetDate) {
                        bestRate = item.value;
                    } else {
                        break;
                    }
                }
                return bestRate;
            };

            const getSpecificMonthRate = (year: number, month: number, dataset: { date: Date, value: number }[]) => {
                return dataset.find(d => {
                    const dDate = new Date(d.date);
                    // Match Year and Month (0-11) EXACTLY
                    return dDate.getUTCFullYear() === year && dDate.getUTCMonth() === month;
                })?.value;
            };

            // Base TC: Start Date - 1 day (Immediate Previous)
            const baseTargetDate = new Date(startDate);
            baseTargetDate.setDate(baseTargetDate.getDate() - 1);
            const baseTC = getClosestRate(baseTargetDate, ratesTC);

            // Simulation State
            let currentRent = fullContract?.initialRent || 0;
            let accumIPC_Period = 1.0;
            let accumIPC_Total = 1.0;
            const adjFreq = fullContract?.adjustmentFrequency || 12;
            let inflationValid = true; // Tracks if we have continuous data

            // Enrich cashflows
            const enrichedCashflows = cashflows.map((cf, index) => {
                const cfDate = new Date(cf.date);
                const year = cfDate.getUTCFullYear();
                const month = cfDate.getUTCMonth();

                // 1. Check for Rent Adjustment (Start of new period)
                if (fullContract?.adjustmentType === 'IPC' && index > 0 && index % adjFreq === 0) {
                    currentRent = currentRent * accumIPC_Period;
                    // Reset period accumulator
                    accumIPC_Period = 1.0;
                }

                // 2. Capture 'Total Inflation' BEFORE current month accumulation
                // User Req: "Always start at 0%".
                // If valid chain broken, stop showing.
                const displayInflationTotal = inflationValid ? (accumIPC_Total - 1) : null;

                // 3. Fetch IPC for THIS CASHFLOW MONTH
                const targetIPCDate = new Date(Date.UTC(year, month, 1));
                const ipcValue = getSpecificMonthRate(targetIPCDate.getUTCFullYear(), targetIPCDate.getUTCMonth(), ratesIPC);

                // 4. Accumulate
                let displayIPCAccum = null;

                if (ipcValue !== undefined && inflationValid) {
                    const multiplier = 1 + ipcValue;
                    accumIPC_Period *= multiplier;
                    accumIPC_Total *= multiplier;

                    // User Req: "Period starts with IPC".
                    // So display POST-multiplication value for Period.
                    displayIPCAccum = accumIPC_Period - 1;
                } else {
                    // Break the chain for FUTURE months (and this one's period accum)
                    inflationValid = false;
                }

                // 5. Determine final amounts
                let amountARS = cf.amountARS || 0;
                if (fullContract?.adjustmentType === 'IPC') {
                    amountARS = currentRent;
                }

                // 6. USD Conversion
                // TC Rule: Immediate Previous Day to Cashflow Date
                const targetTCDate = new Date(cfDate);
                targetTCDate.setDate(targetTCDate.getDate() - 1);

                // Check if target date is beyond known data
                const isTCFuture = targetTCDate > maxTCDate;

                const currentTC = isTCFuture ? null : getClosestRate(targetTCDate, ratesTC);

                let amountUSD = cf.amountUSD;
                let devaluationAccum = cf.devaluationAccum;

                if (currentTC && amountARS) {
                    amountUSD = amountARS / currentTC;

                    if (baseTC) {
                        devaluationAccum = (currentTC / baseTC) - 1;
                    } else {
                        devaluationAccum = 0;
                    }
                } else if (isTCFuture) {
                    // Reset calculations if no TC data
                    amountUSD = null;
                    devaluationAccum = null;
                }

                return {
                    ...cf,
                    amountARS,
                    amountUSD,
                    devaluationAccum,
                    tc: currentTC,
                    tcBase: baseTC,
                    ipcMonthly: ipcValue,
                    ipcAccumulated: displayIPCAccum,        // Post-Accum (M1 = IPC)
                    inflationAccum: displayInflationTotal   // Pre-Accum (M1 = 0%)
                };
            });

            return NextResponse.json(enrichedCashflows);
        }

        return NextResponse.json(cashflows);
    } catch (error) {
        console.error('Error fetching contract cashflows:', error);
        return NextResponse.json({ error: 'Failed to fetch cashflows' }, { status: 500 });
    }
}
