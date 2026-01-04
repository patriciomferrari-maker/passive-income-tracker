import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { z } from 'zod';
import { findCryptoBySymbol } from '@/app/lib/crypto-list';

export const dynamic = 'force-dynamic';

const SmartTransactionSchema = z.object({
    ticker: z.string().min(1),
    type: z.enum(['BUY', 'SELL']),
    quantity: z.number().positive(),
    price: z.number().positive(),
    commission: z.number().min(0).optional().nullable(), // Allow null
    date: z.string(),
    notes: z.string().optional().nullable() // Allow null
});

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();

        const validatedData = SmartTransactionSchema.parse(body);
        const ticker = validatedData.ticker.toUpperCase();

        // 1. Find or Create Investment
        let investment = await prisma.investment.findFirst({
            where: { userId, type: 'CRYPTO', ticker }
        });

        if (!investment) {
            // Check if it's a known popular crypto to get the name
            const cryptoInfo = findCryptoBySymbol(ticker);
            const name = cryptoInfo ? cryptoInfo.name : ticker;

            investment = await prisma.investment.create({
                data: {
                    userId,
                    ticker,
                    name,
                    type: 'CRYPTO',
                    market: 'CRYPTO',
                    lastPrice: validatedData.price // Initialize with transaction price
                }
            });
        }

        // 2. Create Transaction
        const totalAmount = validatedData.quantity * validatedData.price + (validatedData.commission || 0);

        const transaction = await prisma.transaction.create({
            data: {
                investmentId: investment.id,
                type: validatedData.type,
                quantity: validatedData.quantity,
                price: validatedData.price,
                commission: validatedData.commission || 0,
                totalAmount: validatedData.type === 'BUY' ? totalAmount : -totalAmount,
                currency: 'USD',
                date: new Date(validatedData.date),
                notes: validatedData.notes || ''
            }
        });

        // 3. Update Investment Last Price
        await prisma.investment.update({
            where: { id: investment.id },
            data: { lastPrice: validatedData.price }
        });

        return NextResponse.json(transaction, { status: 201 });

    } catch (error) {
        console.error('Smart Transaction Error:', error);

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
