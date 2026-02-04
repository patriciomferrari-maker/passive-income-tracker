
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Fetch Cleaning Data
        const cleaningData = await prisma.barbosaCleaning.findMany({
            where: { userId },
            orderBy: [{ year: 'asc' }, { month: 'asc' }]
        });

        // 2. Fetch IPC Data (Inflation)
        const ipcData = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'asc' }
        });

        // 3. Process Data
        // If no cleaning data, return empty but with success structure
        if (cleaningData.length === 0) {
            return NextResponse.json({ chartData: [], rawData: [] });
        }

        // Find Base Month (First record)
        const baseRecord = cleaningData[0];
        const basePrice = baseRecord.pricePerHour;

        // Helper to get IPC for a specific month/year
        // IPC for Month M is typically published in Month M+1, but represents Month M inflation.
        // We accumulate: Price(M) should be comparable to Price(Base) * Inflation(Base -> M).
        const ipcMap = new Map<string, number>();
        ipcData.forEach(item => {
            const key = `${item.date.getUTCFullYear()}-${item.date.getUTCMonth() + 1}`;
            ipcMap.set(key, item.value);
        });

        let previousPriceTheoretical = basePrice; // Starts at base

        const startYear = baseRecord.year;
        const startMonth = baseRecord.month;

        const now = new Date();
        const endYear = now.getFullYear();
        const endMonth = now.getMonth() + 1; // 1-indexed

        const chartData = [];

        // Loop from Start to End
        let currentYear = startYear;
        let currentMonth = startMonth;

        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
            const key = `${currentYear}-${currentMonth}`;

            // Find user data for this month
            const userRecord = cleaningData.find(d => d.year === currentYear && d.month === currentMonth);

            const ipcValue = ipcMap.get(key) || 0; // % value (e.g. 20.6)

            chartData.push({
                period: `${currentYear}-${currentMonth.toString().padStart(2, '0')}`,
                month: currentMonth,
                year: currentYear,
                pricePerHour: userRecord ? userRecord.pricePerHour : null, // Null helps chart break lines if missing
                theoreticalPrice: previousPriceTheoretical,
                inflationForMonth: ipcValue,
                isBase: (currentYear === startYear && currentMonth === startMonth)
            });

            // Update Theoretical for NEXT month (Cumulative Inflation)
            const monthlyFactor = 1 + (ipcValue / 100);
            previousPriceTheoretical = previousPriceTheoretical * monthlyFactor;

            // Increment Month
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }

        return NextResponse.json({
            chartData,
            rawData: cleaningData
        });

    } catch (error: any) {
        console.error('Error in Cleaning Data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { year, month, pricePerHour, hoursPerWeek } = body;

        // Upsert
        const record = await prisma.barbosaCleaning.upsert({
            where: {
                userId_month_year: {
                    userId,
                    month,
                    year
                }
            },
            update: {
                pricePerHour: parseFloat(pricePerHour),
                hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : undefined,
                weeklyValue: (hoursPerWeek && pricePerHour) ? (parseFloat(pricePerHour) * parseInt(hoursPerWeek)) : 0,
            },
            create: {
                userId,
                month,
                year,
                pricePerHour: parseFloat(pricePerHour),
                hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : 0,
                weeklyValue: (hoursPerWeek && pricePerHour) ? (parseFloat(pricePerHour) * parseInt(hoursPerWeek)) : 0,
                monthlyIncrease: 0,
                paidValue: 0,
                // pricePerHour is required
            }
        });

        return NextResponse.json(record);
    } catch (error: any) {
        console.error('Error saving cleaning data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
