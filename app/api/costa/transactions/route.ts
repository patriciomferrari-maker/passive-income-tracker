import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();
        const transactions = await prisma.costaTransaction.findMany({
            where: { userId },
            include: { category: true },
            orderBy: { date: 'desc' }
        });
        return NextResponse.json(transactions);
    } catch (error) {
        console.error("GET Trx Error:", error);
        return unauthorized();
    }
}


export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { date, type, description, amount, currency, categoryId, rentalCheckIn, rentalCheckOut, contractUrl } = body;

        const newTrx = await prisma.costaTransaction.create({
            data: {
                userId,
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
        return unauthorized();
    }
}

export async function PUT(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { id, date, type, description, amount, currency, categoryId, rentalCheckIn, rentalCheckOut, contractUrl } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Ownership check
        const existing = await prisma.costaTransaction.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
        return unauthorized();
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        // Ownership check
        const existing = await prisma.costaTransaction.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.costaTransaction.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return unauthorized();
    }
}
