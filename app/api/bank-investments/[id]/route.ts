import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const id = params.id;
        const body = await request.json();
        const { type, alias, amount, currency, startDate, durationDays, tna } = body;

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
        return NextResponse.json({ error: 'Failed to update operation' }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const id = params.id;
        await prisma.bankOperation.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting bank operation:', error);
        return NextResponse.json({ error: 'Failed to delete operation' }, { status: 500 });
    }
}
