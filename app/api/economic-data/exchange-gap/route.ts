import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API endpoint for TC Oficial vs TC Blue with gap percentage
 * Returns sell prices for both and calculated gap
 */
export async function GET() {
    try {
        // Get TC Oficial records from BCRA
        const tcOficialRecords = await prisma.economicIndicator.findMany({
            where: { type: 'TC_OFICIAL' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Get TC Blue (Ámbito data) - this is the "sell" price from Ámbito
        const tcBlueRecords = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'asc' },
            select: { date: true, value: true, sellRate: true }
        });

        if (tcOficialRecords.length === 0 || tcBlueRecords.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Create maps for easier lookup
        const tcOficialByDate = new Map<string, number>();
        tcOficialRecords.forEach(record => {
            const dateKey = new Date(record.date).toISOString().slice(0, 10); // YYYY-MM-DD
            tcOficialByDate.set(dateKey, record.value);
        });

        const tcBlueByDate = new Map<string, number>();
        tcBlueRecords.forEach(record => {
            const dateKey = new Date(record.date).toISOString().slice(0, 10);
            // Use sellRate if available, otherwise fall back to value
            const sellPrice = record.sellRate || record.value;
            tcBlueByDate.set(dateKey, sellPrice);
        });

        // Get all unique dates where we have both TC types
        const allDates = Array.from(new Set([
            ...Array.from(tcOficialByDate.keys()),
            ...Array.from(tcBlueByDate.keys())
        ])).sort();

        // Build data array with gap calculation
        const data: Array<{ date: string; tcOficial: number; tcBlue: number; brecha: number }> = [];

        allDates.forEach(dateKey => {
            const tcOficial = tcOficialByDate.get(dateKey);
            const tcBlue = tcBlueByDate.get(dateKey);

            // Only include if we have both values
            if (tcOficial !== undefined && tcBlue !== undefined) {
                // Calculate gap: ((Blue - Oficial) / Oficial) * 100
                const brecha = ((tcBlue - tcOficial) / tcOficial) * 100;

                data.push({
                    date: dateKey,
                    tcOficial,
                    tcBlue,
                    brecha
                });
            }
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching exchange rate gap data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
