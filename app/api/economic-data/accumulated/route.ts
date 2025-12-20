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

        // Calculate accumulated values (base = 100 at first available month)
        const data: Array<{ date: string; inflacionAcumulada: number; devaluacionAcumulada: number }> = [];

        let baseIPC: number | null = null;
        let baseTC: number | null = null;
        let accumulatedIPC = 100;
        let accumulatedTC = 100;

        allMonths.forEach((monthKey, index) => {
            const ipcValue = ipcByMonth.get(monthKey);
            const tcValue = tcMonthlyAvg.get(monthKey);

            // Set base values on first month where both are available
            if (baseIPC === null && ipcValue !== undefined && tcValue !== undefined) {
                baseIPC = ipcValue;
                baseTC = tcValue;
            }

            // Calculate accumulated only if we have base values
            if (baseIPC && baseTC && ipcValue !== undefined && tcValue !== undefined) {
                // For IPC, it's monthly variation, so we compound it
                if (index > 0) {
                    const prevMonth = allMonths[index - 1];
                    const prevIPC = ipcByMonth.get(prevMonth);
                    if (prevIPC !== undefined) {
                        accumulatedIPC *= (1 + ipcValue / 100);
                    }

                    const prevTC = tcMonthlyAvg.get(prevMonth);
                    if (prevTC !== undefined) {
                        accumulatedTC = (tcValue / baseTC) * 100;
                    }
                }

                data.push({
                    date: `${monthKey}-01`,
                    inflacionAcumulada: accumulatedIPC - 100, // Convert back to percentage
                    devaluacionAcumulada: accumulatedTC - 100
                });
            }
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching accumulated data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
