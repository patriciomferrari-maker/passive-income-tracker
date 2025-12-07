import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const transactions = await prisma.costaTransaction.findMany({
            include: { category: true },
            orderBy: { date: 'desc' }
        });
        return NextResponse.json(transactions);
    } catch (error) {
        console.error("GET Trx Error:", error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, type, description, amount, currency, categoryId, rentalCheckIn, rentalCheckOut, contractUrl } = body;

        const newTrx = await prisma.costaTransaction.create({
            data: {
                date: new Date(date),
                type,
                description,
                amount: parseFloat(amount),
                currency,
                categoryId: categoryId || null,
                rentalCheckIn: rentalCheckIn ? new Date(rentalCheckIn) : null,
                rentalCheckOut: rentalCheckOut ? new Date(rentalCheckOut) : null,
                contractUrl: contractUrl || null
            }
        });
        return NextResponse.json(newTrx);
    } catch (error) {
        console.error("POST Trx Error Details:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create transaction' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, date, type, description, amount, currency, categoryId, rentalCheckIn, rentalCheckOut, contractUrl } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const updatedTrx = await prisma.costaTransaction.update({
            where: { id },
            data: {
                date: new Date(date),
                type,
                description,
                amount: parseFloat(amount),
                currency,
                categoryId: categoryId || null,
                rentalCheckIn: rentalCheckIn ? new Date(rentalCheckIn) : null,
                rentalCheckOut: rentalCheckOut ? new Date(rentalCheckOut) : null,
                contractUrl: contractUrl || null
            }
        });
        return NextResponse.json(updatedTrx);
    } catch (error) {
        console.error("PUT Trx Error Details:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update transaction' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await prisma.costaTransaction.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}
