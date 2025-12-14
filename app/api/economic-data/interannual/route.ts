import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await getUserId(); // Verify authentication

        // Get all IPC records (with interannual values if available)
        const ipcRecords = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true, interannualValue: true }
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

        // Map IPC records by month (use scraped interannual value if available)
        const ipcByMonth = new Map<string, { value: number; interannualValue: number | null }>();
        ipcRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7);
            ipcByMonth.set(monthKey, {
                value: record.value,
                interannualValue: record.interannualValue
            });
        });

        // Get all unique months (sorted)
        const allMonths = Array.from(new Set([
            ...Array.from(ipcByMonth.keys()),
            ...Array.from(tcMonthlyAvg.keys())
        ])).sort();

        // Calculate interannual variations
        const data: Array<{ date: string; inflacion: number; devaluacion: number }> = [];

        // Calculate interannual for each month
        allMonths.forEach((monthKey) => {
            const ipcData = ipcByMonth.get(monthKey);

            // Use scraped interannual value if available, otherwise null
            const inflacion = ipcData?.interannualValue ?? null;

            // Calculate TC interannual
            const monthIndex = allMonths.indexOf(monthKey);
            if (monthIndex < 12) return; // Need 12 months of history for TC

            const date12MonthsAgo = allMonths[monthIndex - 12];
            const tcCurrent = tcMonthlyAvg.get(monthKey);
            const tc12MonthsAgo = tcMonthlyAvg.get(date12MonthsAgo);
            const devaluacion = (tcCurrent && tc12MonthsAgo)
                ? ((tcCurrent / tc12MonthsAgo) - 1) * 100
                : null;

            // Include if we have at least ONE value (inflation OR devaluation)
            if (inflacion !== null || devaluacion !== null) {
                data.push({
                    date: `${monthKey}-01`, // First day of month for consistency
                    inflacion: inflacion || 0, // Use 0 if null to avoid chart issues
                    devaluacion: devaluacion || 0
                });
            }
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching interannual data:', error);
        return unauthorized();
    }
}
