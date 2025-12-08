import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const userId = await getUserId();
        const params = await props.params;
        const id = params.id;
        const body = await request.json();
        const { type, alias, amount, currency, startDate, durationDays, tna } = body;

        // Verify ownership
        const existing = await prisma.bankOperation.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const updatedOp = await prisma.bankOperation.update({
            where: { id },
            data: {
                type,
                alias,
                amount: parseFloat(amount),
                currency,
                startDate: startDate ? new Date(startDate) : null,
                durationDays: durationDays ? parseInt(durationDays) : null,
                tna: tna ? parseFloat(tna) : null
            }
        });

        return NextResponse.json(updatedOp);
    } catch (error) {
        console.error('Error updating bank operation:', error);
        return unauthorized();
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const userId = await getUserId();
        const params = await props.params;
        const id = params.id;

        // Verify ownership
        const existing = await prisma.bankOperation.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.bankOperation.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting bank operation:', error);
        return unauthorized();
    }
}
