import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await getUserId(); // Verify authentication

        // Get all IPC records
        const ipcRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Get all TC records
        const tcRecords = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Group TC by month and calculate average
        const tcByMonth = new Map<string, { sum: number; count: number }>();

        tcRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7); // YYYY-MM
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

        // Calculate interannual variations
        const data: Array<{ date: string; inflacion: number | null; devaluacion: number | null }> = [];

        // Process IPC (already monthly)
        const ipcByMonth = new Map<string, number>();
        ipcRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7);
            ipcByMonth.set(monthKey, record.value);
        });

        // Get all unique months (sorted)
        const allMonths = Array.from(new Set([
            ...Array.from(ipcByMonth.keys()),
            ...Array.from(tcMonthlyAvg.keys())
        ])).sort();

        // Calculate interannual for each month (need 12 months prior)
        allMonths.forEach((monthKey, index) => {
            if (index < 12) return; // Skip first 12 months (no data to compare)

            const date12MonthsAgo = allMonths[index - 12];

            // Calculate IPC interannual
            const ipcCurrent = ipcByMonth.get(monthKey);
            const ipc12MonthsAgo = ipcByMonth.get(date12MonthsAgo);
            const inflacion = (ipcCurrent && ipc12MonthsAgo)
                ? ((ipcCurrent / ipc12MonthsAgo) - 1) * 100
                : null;

            // Calculate TC interannual
            const tcCurrent = tcMonthlyAvg.get(monthKey);
            const tc12MonthsAgo = tcMonthlyAvg.get(date12MonthsAgo);
            const devaluacion = (tcCurrent && tc12MonthsAgo)
                ? ((tcCurrent / tc12MonthsAgo) - 1) * 100
                : null;

            // Only include if we have at least one value
            if (inflacion !== null || devaluacion !== null) {
                data.push({
                    date: `${monthKey}-01`, // First day of month for consistency
                    inflacion,
                    devaluacion
                });
            }
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching interannual data:', error);
        return unauthorized();
    }
}
