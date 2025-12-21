import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API endpoint for accumulated inflation vs devaluation
 * Extended scope to match IPC historical data range
 */
export async function GET() {
    try {
        // Get all IPC records
        const ipcRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Get all TC Blue records (Ámbito data)
        const tcBlueRecords = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        if (ipcRecords.length === 0 || tcBlueRecords.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Group IPC by month (it's monthly data)
        const ipcByMonth = new Map<string, number>();
        ipcRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7); // YYYY-MM
            ipcByMonth.set(monthKey, record.value);
        });

        // Group TC Blue by month and calculate average
        const tcByMonth = new Map<string, { sum: number; count: number }>();
        tcBlueRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7);
            const existing = tcByMonth.get(monthKey) || { sum: 0, count: 0 };
            tcByMonth.set(monthKey, {
                sum: existing.sum + record.value,
                count: existing.count + 1
            });
        });

        // Calculate monthly averages for TC
        const tcMonthlyAvg = new Map<string, number>();
        tcByMonth.forEach((value, key) => {
            tcMonthlyAvg.set(key, value.sum / value.count);
        });

        // Get all unique months sorted
        const allMonths = Array.from(new Set([
            ...Array.from(ipcByMonth.keys()),
            ...Array.from(tcMonthlyAvg.keys())
        ])).sort();

        // Calculate accumulated values starting from 0% at first common month
        const data: Array<{ date: string; inflacionAcumulada: number; devaluacionAcumulada: number }> = [];

        // Find first month where BOTH IPC and TC are available
        let startIndex = -1;
        for (let i = 0; i < allMonths.length; i++) {
            if (ipcByMonth.has(allMonths[i]) && tcMonthlyAvg.has(allMonths[i])) {
                startIndex = i;
                break;
            }
        }

        if (startIndex === -1) {
            return NextResponse.json({ data: [] });
        }

        // Get base TC for devaluation calculation
        const baseTC = tcMonthlyAvg.get(allMonths[startIndex])!;

        // Build accumulated data
        let accumulatedInflation = 1; // Start at 1 (represents 100%)

        for (let i = startIndex; i < allMonths.length; i++) {
            const monthKey = allMonths[i];
            const ipcValue = ipcByMonth.get(monthKey);
            const tcValue = tcMonthlyAvg.get(monthKey);

            // Skip months where either value is missing
            if (ipcValue === undefined || tcValue === undefined) {
                continue;
            }

            // For first month: 0%
            // For second month: IPC of first month
            // For third month onwards: compound
            if (i === startIndex) {
                // First month: 0%
                data.push({
                    date: `${monthKey}-01`,
                    inflacionAcumulada: 0,
                    devaluacionAcumulada: 0
                });
            } else {
                // Get previous month's IPC for compounding
                const prevMonthKey = allMonths[i - 1];
                const prevIPC = ipcByMonth.get(prevMonthKey);

                if (prevIPC !== undefined) {
                    // Compound: multiply by (1 + prev_month_ipc%)
                    accumulatedInflation *= (1 + prevIPC / 100);
                }

                // Devaluation: simple percentage from base
                const devaluacion = ((tcValue - baseTC) / baseTC) * 100;

                data.push({
                    date: `${monthKey}-01`,
                    inflacionAcumulada: (accumulatedInflation - 1) * 100, // Convert to percentage
                    devaluacionAcumulada: devaluacion
                });
            }
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching accumulated data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
