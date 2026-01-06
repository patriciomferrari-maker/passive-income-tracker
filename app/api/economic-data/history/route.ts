
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'TC_USD_ARS';

        const rates = await prisma.economicIndicator.findMany({
            where: { type },
            orderBy: { date: 'desc' }
        });

        // Convert to a lighter map format for frontend: { "YYYY-MM-DD": value }
        const ratesMap: Record<string, number> = {};
        rates.forEach(r => {
            const dateStr = r.date.toISOString().split('T')[0];
            ratesMap[dateStr] = r.value;
        });

        return NextResponse.json(ratesMap);
    } catch (error) {
        console.error('Error fetching rates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
