import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session || !session.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        await prisma.dollarPurchase.deleteMany({
            where: {
                id: params.id,
                userId: user.id
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting dollar purchase:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
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

        const updated = await prisma.dollarPurchase.updateMany({
            where: {
                id: params.id,
                userId: user.id
            },
            data: {
                date: new Date(date),
                amount: parseFloat(amount),
                rate: rate ? parseFloat(rate) : null,
                amountARS: amountARS ? parseFloat(amountARS) : null,
                source,
            }
        });

        if (updated.count === 0) {
            return NextResponse.json({ error: 'Not found or permission denied' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating dollar purchase:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
