import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cashflows = await prisma.cashflow.findMany({
            where: {
                investmentId: id
            },
            orderBy: {
                date: 'asc'
            }
        });

        return NextResponse.json(cashflows);
    } catch (error) {
        console.error('Error fetching cashflows:', error);
        return NextResponse.json({ error: 'Failed to fetch cashflows' }, { status: 500 });
    }
}
