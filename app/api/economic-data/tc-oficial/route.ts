import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const where: any = { type: 'TC_OFICIAL' };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        const data = await prisma.economicIndicator.findMany({
            where,
            orderBy: { date: 'desc' },
            // Removed take limit to show full history for charts
            select: {
                date: true,
                value: true
            }
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching TC Oficial data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch TC Oficial data' },
            { status: 500 }
        );
    }
}
