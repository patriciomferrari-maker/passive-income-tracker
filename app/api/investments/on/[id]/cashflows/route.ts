import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Verify ownership first
        const investment = await prisma.investment.findFirst({
            where: { id, userId }
        });
        if (!investment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const cashflows = await prisma.cashflow.findMany({
            where: {
                investmentId: id,
                status: 'PROJECTED'
            },
            orderBy: { date: 'asc' }
        });

        return NextResponse.json(cashflows);
    } catch (error) {
        console.error('Error fetching cashflows:', error);
        return unauthorized();
    }
}
