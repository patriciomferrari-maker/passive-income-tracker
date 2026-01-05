import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateTransactionSchema = z.object({
    type: z.enum(['BUY', 'SELL']),
    quantity: z.number().positive(),
    price: z.number().positive(),
    commission: z.number().min(0).optional().nullable(),
    date: z.string(),
    notes: z.string().optional().nullable()
});

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { investment: true }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.investment.userId !== userId) {
            return unauthorized();
        }

        await prisma.transaction.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;
        const body = await request.json();

        const validatedData = UpdateTransactionSchema.parse(body);

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { investment: true }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.investment.userId !== userId) {
            return unauthorized();
        }

        const totalAmount = validatedData.quantity * validatedData.price + (validatedData.commission || 0);

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                type: validatedData.type,
                quantity: validatedData.quantity,
                price: validatedData.price,
                commission: validatedData.commission || 0,
                totalAmount: validatedData.type === 'BUY' ? totalAmount : -totalAmount,
                date: new Date(validatedData.date),
                notes: validatedData.notes || ''
            }
        });

        return NextResponse.json(updatedTransaction);

    } catch (error) {
        console.error('Error updating transaction:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
