import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const operations = await prisma.bankOperation.findMany({
            orderBy: { createdAt: 'desc' }
        });

        // Calculate Summary Stats
        let totalARS = 0;
        let totalUSD = 0;
        let estimatedInterest = 0;

        operations.forEach(op => {
            if (op.currency === 'ARS') totalARS += op.amount;
            if (op.currency === 'USD') totalUSD += op.amount;

            // Plazo Fijo Interest Calculation (Simple: Amount * TNA * Days / 365)
            if (op.type === 'PLAZO_FIJO' && op.tna && op.durationDays) {
                const interest = (op.amount * (op.tna / 100) * op.durationDays) / 365;
                estimatedInterest += interest;
            }
        });

        return NextResponse.json({
            operations,
            stats: {
                totalARS,
                totalUSD,
                estimatedInterest
            }
        });

    } catch (error) {
        console.error('Error fetching bank operations:', error);
        return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, alias, amount, currency, startDate, durationDays, tna } = body;

        const newOp = await prisma.bankOperation.create({
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

        return NextResponse.json(newOp);
    } catch (error) {
        console.error('Error creating bank operation:', error);
        return NextResponse.json({ error: 'Failed to create operation' }, { status: 500 });
    }
}
