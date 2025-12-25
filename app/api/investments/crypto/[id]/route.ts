import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateCryptoSchema = z.object({
    name: z.string().min(1).optional(),
    lastPrice: z.number().optional(),
    notes: z.string().optional()
});

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const userId = await getUserId();
        const { id } = params;

        const crypto = await prisma.investment.findFirst({
            where: {
                id,
                userId,
                type: 'CRYPTO'
            },
            include: {
                transactions: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!crypto) {
            return NextResponse.json(
                { error: 'Crypto not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(crypto);
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

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const userId = await getUserId();
        const { id } = params;
        const body = await request.json();

        const validatedData = UpdateCryptoSchema.parse(body);

        // Verify ownership
        const existing = await prisma.investment.findFirst({
            where: { id, userId, type: 'CRYPTO' }
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Crypto not found' },
                { status: 404 }
            );
        }

        const updated = await prisma.investment.update({
            where: { id },
            data: validatedData
        });

        return NextResponse.json(updated);
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

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const userId = await getUserId();
        const { id } = params;

        // Verify ownership
        const existing = await prisma.investment.findFirst({
            where: { id, userId, type: 'CRYPTO' }
        });

        if (!existing) {
            return NextResponse.json(
                { error: 'Crypto not found' },
                { status: 404 }
            );
        }

        // Check if has transactions
        const txCount = await prisma.transaction.count({
            where: { investmentId: id }
        });

        if (txCount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete crypto with existing transactions' },
                { status: 400 }
            );
        }

        await prisma.investment.delete({ where: { id } });

        return NextResponse.json({ success: true });
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
