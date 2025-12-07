import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';

// GET transactions for an ON
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

// POST new purchase
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
                currency: 'ARS'
            }
        });

        // Generate and save cashflows
        const cashflows = await generateInvestmentCashflow(id);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}
