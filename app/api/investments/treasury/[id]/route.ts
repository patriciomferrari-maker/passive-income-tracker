import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET single treasury
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;
        const treasury = await prisma.investment.findFirst({
            where: { id, userId },
            include: {
                transactions: true,
                cashflows: true
            }
        });

        if (!treasury) {
            return NextResponse.json({ error: 'Treasury not found' }, { status: 404 });
        }

        return NextResponse.json(treasury);
    } catch (error) {
        console.error('Error fetching treasury:', error);
        return unauthorized();
    }
}

// PUT update treasury
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;
        const body = await request.json();
        const { ticker, name, emissionDate, couponRate, frequency, maturityDate } = body;

        // Verify ownership
        const existing = await prisma.investment.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const treasury = await prisma.investment.update({
            where: { id },
            data: {
                ticker,
                name,
                emissionDate: emissionDate ? new Date(emissionDate) : null,
                couponRate: couponRate ? parseFloat(couponRate) : null,
                frequency: frequency ? parseInt(frequency) : null,
                maturityDate: maturityDate ? new Date(maturityDate) : null
            }
        });

        return NextResponse.json(treasury);
    } catch (error) {
        console.error('Error updating treasury:', error);
        return unauthorized();
    }
}

// DELETE treasury
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Verify ownership
        const existing = await prisma.investment.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.investment.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting treasury:', error);
        return unauthorized();
    }
}
