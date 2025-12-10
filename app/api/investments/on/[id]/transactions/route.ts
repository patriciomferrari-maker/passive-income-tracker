import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET transactions for an ON
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Verify ownership first
        const investment = await prisma.investment.findFirst({
            where: { id, userId }
        });
        if (!investment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const transactions = await prisma.transaction.findMany({
            where: {
                investmentId: id,
                type: 'BUY'
            },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return unauthorized();
    }
}

// POST new purchase
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Verify ownership
        const investment = await prisma.investment.findFirst({
            where: { id, userId }
        });
        if (!investment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await request.json();
        const { date, quantity, price, commission } = body;

        const totalAmount = -(parseFloat(quantity) * parseFloat(price) + parseFloat(commission || 0));

        const transaction = await prisma.transaction.create({
            data: {
                investmentId: id,
                date: new Date(date),
                type: 'BUY',
                quantity: parseFloat(quantity),
                price: parseFloat(price),
                commission: parseFloat(commission || 0),
                totalAmount,
                currency: body.currency || 'ARS'
            }
        });

        // Generate and save cashflows
        const cashflows = await generateInvestmentCashflow(id);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        return unauthorized();
    }
}
