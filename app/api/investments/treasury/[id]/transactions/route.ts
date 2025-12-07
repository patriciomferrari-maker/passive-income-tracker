import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const transactions = await prisma.transaction.findMany({
            where: {
                investmentId: id
            },
            orderBy: {
                date: 'asc'
            }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}


export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { date, quantity, price, commission } = body;

        const qty = parseFloat(quantity);
        const prc = parseFloat(price);
        const comm = parseFloat(commission);
        const total = -(qty * prc + comm);

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                investmentId: id,
                date: new Date(date),
                type: 'BUY',
                quantity: qty,
                price: prc,
                commission: comm,
                totalAmount: total,
                currency: 'USD'
            }
        });

        // Regenerate cashflows
        const cashflows = await generateInvestmentCashflow(id);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}
