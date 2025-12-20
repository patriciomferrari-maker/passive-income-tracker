import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API endpoint for UVA evolution vs TC and inflation
 * Returns normalized values (base 100) for comparison
 */
export async function GET() {
    try {
        // Get UVA records
        const uvaRecords = await prisma.economicIndicator.findMany({
            where: { type: 'UVA' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Get TC Blue records
        const tcBlueRecords = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Get TC Oficial records
        const tcOficialRecords = await prisma.economicIndicator.findMany({
            where: { type: 'TC_OFICIAL' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Get IPC records (monthly)
        const ipcRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        if (uvaRecords.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Create maps by date
        const uvaByDate = new Map<string, number>();
        uvaRecords.forEach(record => {
            const dateKey = new Date(record.date).toISOString().slice(0, 10);
            uvaByDate.set(dateKey, record.value);
        });

        const tcBlueByDate = new Map<string, number>();
        tcBlueRecords.forEach(record => {
            const dateKey = new Date(record.date).toISOString().slice(0, 10);
            tcBlueByDate.set(dateKey, record.value);
        });

        const tcOficialByDate = new Map<string, number>();
        tcOficialRecords.forEach(record => {
            const dateKey = new Date(record.date).toISOString().slice(0, 10);
            tcOficialByDate.set(dateKey, record.value);
        });

        // IPC is monthly, so map by month
        const ipcByMonth = new Map<string, number>();
        ipcRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7); // YYYY-MM
            ipcByMonth.set(monthKey, record.value);
        });

        // Get all unique dates from UVA (primary series)
        const allDates = Array.from(uvaByDate.keys()).sort();

        // Find base values (first date with all data)
        let baseUVA: number | null = null;
        let baseTCBlue: number | null = null;
        let baseTCOficial: number | null = null;
        let accumulatedIPC = 100; // Start at base 100

        const data: Array<{
            date: string;
            uva: number;
            uvaNormalized: number;
            tcBlueNormalized: number;
            tcOficialNormalized: number;
            ipcNormalized: number;
        }> = [];

        allDates.forEach((dateKey, index) => {
            const uva = uvaByDate.get(dateKey);
            const tcBlue = tcBlueByDate.get(dateKey);
            const tcOficial = tcOficialByDate.get(dateKey);
            const monthKey = dateKey.slice(0, 7);
            const ipcMonthly = ipcByMonth.get(monthKey);

            if (uva === undefined) return;

            // Set base values on first complete record
            if (baseUVA === null && tcBlue !== undefined && tcOficial !== undefined) {
                baseUVA = uva;
                baseTCBlue = tcBlue;
                baseTCOficial = tcOficial;
            }

            // Accumulate IPC (compound monthly inflation)
            if (index > 0 && ipcMonthly !== undefined) {
                const prevMonthKey = allDates[index - 1].slice(0, 7);
                // Only accumulate when we transition to a new month
                if (monthKey !== prevMonthKey) {
                    accumulatedIPC *= (1 + ipcMonthly / 100);
                }
            }

            // Calculate normalized values
            if (baseUVA && baseTCBlue && baseTCOficial) {
                const uvaNormalized = (uva / baseUVA) * 100;
                const tcBlueNormalized = tcBlue !== undefined ? (tcBlue / baseTCBlue) * 100 : 100;
                const tcOficialNormalized = tcOficial !== undefined ? (tcOficial / baseTCOficial) * 100 : 100;

                data.push({
                    date: dateKey,
                    uva,
                    uvaNormalized,
                    tcBlueNormalized,
                    tcOficialNormalized,
                    ipcNormalized: accumulatedIPC
                });
            }
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching UVA evolution data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
