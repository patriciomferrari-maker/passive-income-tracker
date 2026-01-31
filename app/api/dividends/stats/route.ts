
import { prisma } from '@/lib/prisma';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // Optional: Filter by Year? Default to last 12 months or current year?
        // Let's get ALL dividends and group them locally or via DB.
        // Prisma group by date is tricky across DBs, let's fetch and reduce.
        const dividends = await prisma.cashflow.findMany({
            where: {
                investment: { userId },
                type: 'DIVIDEND',
                date: { lte: new Date() } // Only past/paid dividends
            },
            orderBy: { date: 'asc' },
            select: {
                date: true,
                amount: true,
                currency: true
            }
        });

        // Group by Month (YYYY-MM)
        const monthlyData: Record<string, number> = {};

        dividends.forEach(d => {
            const key = d.date.toISOString().slice(0, 7); // YYYY-MM
            let val = d.amount;
            // Simple conversion if needed, but usually we just sum USD
            if (d.currency === 'ARS') val = val / 1140; // Approx rate or fetch historical? 
            // For now let's assume most dividends are stored in USD or converted.

            monthlyData[key] = (monthlyData[key] || 0) + val;
        });

        // Convert to array for Recharts
        // Fill missing months for the last 12 months? Or just show what we have?
        // Let's return sorted keys.
        const chartData = Object.keys(monthlyData).sort().map(key => ({
            month: key,
            amount: monthlyData[key]
        }));

        // Limit to last 12-24 months to avoid overcrowding
        const slicedData = chartData.slice(-24);

        return NextResponse.json({
            success: true,
            data: slicedData,
            totalAllTime: Object.values(monthlyData).reduce((a, b) => a + b, 0)
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
