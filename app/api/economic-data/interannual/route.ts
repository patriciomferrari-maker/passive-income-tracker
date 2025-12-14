import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        await getUserId(); // Verify authentication

        // Get all IPC records (monthly variations in %)
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

        // Build accumulated IPC index from monthly variations
        // Start with base 100 at first month
        // IMPORTANT: Normalize data format - some values are decimals (0.027), others are percentages (2.7)
        const ipcIndex = new Map<string, number>();
        let accumulatedIndex = 100;

        ipcRecords.forEach(record => {
            const monthKey = new Date(record.date).toISOString().slice(0, 7);
            // Normalize: if value < 1, it's a decimal (0.027 = 2.7%), multiply by 100
            const monthlyVariationPercent = record.value < 1 ? record.value * 100 : record.value;
            // Apply monthly variation: index * (1 + variation/100)
            accumulatedIndex = accumulatedIndex * (1 + monthlyVariationPercent / 100);
            ipcIndex.set(monthKey, accumulatedIndex);
        });

        // Get all unique months (sorted)
        const allMonths = Array.from(new Set([
            ...Array.from(ipcIndex.keys()),
            ...Array.from(tcMonthlyAvg.keys())
        ])).sort();

        // Calculate interannual variations
        const data: Array<{ date: string; inflacion: number; devaluacion: number }> = [];

        // Calculate interannual for each month (need 12 months prior)
        allMonths.forEach((monthKey, index) => {
            if (index < 12) return; // Skip first 12 months (no data to compare)

            const date12MonthsAgo = allMonths[index - 12];

            // Calculate IPC interannual using accumulated index
            const ipcCurrent = ipcIndex.get(monthKey);
            const ipc12MonthsAgo = ipcIndex.get(date12MonthsAgo);
            const inflacion = (ipcCurrent && ipc12MonthsAgo)
                ? ((ipcCurrent / ipc12MonthsAgo) - 1) * 100
                : null;

            // Calculate TC interannual
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
