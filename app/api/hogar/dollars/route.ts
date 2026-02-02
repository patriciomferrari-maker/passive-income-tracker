import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: Request) {
    const session = await auth();
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const purchases = await prisma.dollarPurchase.findMany({
            where: { userId: user.id },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(purchases);
    } catch (error) {
        console.error('Error fetching dollar purchases:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await request.json();
        const { date, amount, rate, amountARS, source } = body;

        const purchase = await prisma.dollarPurchase.create({
            data: {
                userId: user.id,
                date: new Date(date),
                amount: parseFloat(amount),
                rate: rate ? parseFloat(rate) : null,
                amountARS: amountARS ? parseFloat(amountARS) : null,
                source,
            }
        });

        return NextResponse.json(purchase);
    } catch (error) {
        console.error('Error creating dollar purchase:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
