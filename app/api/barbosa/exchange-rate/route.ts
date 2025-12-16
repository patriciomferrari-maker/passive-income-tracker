import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Get the latest recorded exchange rate
        const indicator = await prisma.economicIndicator.findFirst({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'desc' },
            take: 1
        });

        if (!indicator) {
            // Fallback or return null
            return NextResponse.json({ rate: null });
        }

        return NextResponse.json({ rate: indicator.value, date: indicator.date });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 });
    }
}
