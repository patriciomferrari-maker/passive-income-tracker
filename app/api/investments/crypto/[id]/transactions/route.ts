import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateTransactionSchema = z.object({
    type: z.enum(['BUY', 'SELL']),
    quantity: z.number().positive(),
    price: z.number().positive(),
    commission: z.number().min(0).optional(),
    date: z.string(),
    notes: z.string().optional()
});

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;  // AWAIT params

        // Verify ownership
        const crypto = await prisma.investment.findFirst({
            where: { id, userId, type: 'CRYPTO' }
        });

        if (!crypto) {
            return NextResponse.json(
                { error: 'Crypto not found' },
                { status: 404 }
            );
        }

        const transactions = await prisma.transaction.findMany({
            where: { investmentId: id },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;  // AWAIT params - Next.js 15 change
        const body = await request.json();

        const validatedData = CreateTransactionSchema.parse(body);

        // Verify ownership
        const crypto = await prisma.investment.findFirst({
            where: { id, userId, type: 'CRYPTO' }
        });

        if (!crypto) {
            return NextResponse.json(
                { error: 'Crypto not found' },
                { status: 404 }
            );
        }

        const totalAmount = validatedData.quantity * validatedData.price + (validatedData.commission || 0);

        const transaction = await prisma.transaction.create({
            data: {
                investmentId: id,
                type: validatedData.type,
                quantity: validatedData.quantity,
                price: validatedData.price,
                commission: validatedData.commission || 0,
                totalAmount: validatedData.type === 'BUY' ? totalAmount : -totalAmount,
                currency: 'USD',
                date: new Date(validatedData.date),
                notes: validatedData.notes
            }
        });

        // Update lastPrice on the investment
        await prisma.investment.update({
            where: { id },
            data: { lastPrice: validatedData.price }
        });

        return NextResponse.json(transaction, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return unauthorized();
        }

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
