import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function PUT(
    request: Request,
    props: { params: Promise<{ paymentId: string }> }
) {
    const params = await props.params;
    try {
        const body = await request.json();
        const { amount, date, description, type } = body;

        // Validation (basic)
        if (!amount || !date || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const updatedPayment = await prisma.debtPayment.update({
            where: {
                id: params.paymentId
            },
            data: {
                amount: parseFloat(amount),
                date: new Date(date),
                description,
                type // Assuming Prisma schema and client are synced to accept this string enum/value
            }
        });

        return NextResponse.json(updatedPayment);
    } catch (error) {
        console.error('Error updating payment:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    props: { params: Promise<{ paymentId: string }> }
) {
    const params = await props.params;
    try {
        await prisma.debtPayment.delete({
            where: {
                id: params.paymentId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting payment:', error);
        return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
    }
}
