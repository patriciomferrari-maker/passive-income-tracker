import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all transactions, optionally filtered by type
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const typeParam = searchParams.get('type');
        console.log(`[API] Fetching transactions for user ${userId}. Type Filter: ${typeParam}`);

        let typeFilter = {};

        if (typeParam) {
            const types = typeParam.split(',');
            if (types.length > 1) {
                typeFilter = { type: { in: types } };
            } else {
                typeFilter = { type: typeParam };
            }
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId, // Filter by User
                    ...typeFilter // Optional Type Filter
                }
            },
            include: {
                investment: {
                    select: {
                        ticker: true,
                        name: true,
                        type: true,
                        lastPrice: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return unauthorized();
    }
}

// POST create a transaction (Generic)
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const json = await request.json();
        const { investmentId, date, quantity, price, commission, type = 'BUY', currency } = json;

        if (!investmentId || !date || !quantity || !price) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify ownership
        const investment = await prisma.investment.findUnique({
            where: { id: investmentId }
        });

        if (!investment || investment.userId !== userId) {
            return unauthorized();
        }

        // For SELL transactions, we might want to store quantity as positive in the DB
        // but the current logic in PurchasesTab seems to assume positive quantity for display
        // and usually we handle the sign logic in the application.
        // HOWEVER, if we look at `PurchasesTab.tsx` code:
        // `totalPaid = Math.abs(tx.totalAmount)`
        // It seems `totalAmount` carries the sign? 
        // Let's stick to: Quantity always positive. Type determines direction.

        const amountSign = type === 'BUY' ? -1 : 1;
        // Buy = Outflow (Negative), Sell = Inflow (Positive)
        // Commission is always an expense (Negative impact on net)

        // Total Amount:
        // Buy: -(Qty * Price) - Commission
        // Sell: (Qty * Price) - Commission

        let totalAmount = 0;
        if (type === 'BUY') {
            totalAmount = -(quantity * price) - (commission || 0);
        } else {
            totalAmount = (quantity * price) - (commission || 0);
        }

        const transaction = await prisma.transaction.create({
            data: {
                investmentId,
                date: new Date(date),
                type,
                quantity: Number(quantity),
                price: Number(price),
                commission: Number(commission) || 0,
                totalAmount,
                currency: currency || investment.currency
            }
        });

        return NextResponse.json(transaction);

    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
