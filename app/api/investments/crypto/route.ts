import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateCryptoSchema = z.object({
    ticker: z.string().min(1).max(10),
    name: z.string().min(1),
    lastPrice: z.number().optional(),
    notes: z.string().optional()
});

export async function GET() {
    try {
        const userId = await getUserId();

        const cryptos = await prisma.investment.findMany({
            where: {
                userId,
                type: 'CRYPTO',
                market: 'CRYPTO'
            },
            include: {
                transactions: {
                    orderBy: { date: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(cryptos);
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

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();

        const validatedData = CreateCryptoSchema.parse(body);

        const crypto = await prisma.investment.create({
            data: {
                userId,
                ticker: validatedData.ticker.toUpperCase(),
                name: validatedData.name,
                type: 'CRYPTO',
                market: 'CRYPTO',
                lastPrice: validatedData.lastPrice || 0,
                notes: validatedData.notes
            }
        });

        return NextResponse.json(crypto, { status: 201 });
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
