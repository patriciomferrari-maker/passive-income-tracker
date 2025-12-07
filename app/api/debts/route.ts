import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const debts = await prisma.debt.findMany({
            include: {
                payments: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Enrich with balance calculation
        const debtsWithBalance = debts.map(debt => {
            const totalPaid = debt.payments
                .filter(p => p.type === 'PAYMENT' || !p.type) // Default backward compatibility
                .reduce((sum, p) => sum + p.amount, 0);

            const totalIncreased = debt.payments
                .filter(p => p.type === 'INCREASE')
                .reduce((sum, p) => sum + p.amount, 0);

            const currentBalance = (debt.initialAmount + totalIncreased) - totalPaid;

            return {
                ...debt,
                totalPaid,
                totalIncreased,
                balance: currentBalance
            };
        });

        return NextResponse.json(debtsWithBalance);
    } catch (error) {
        console.error('Error fetching debts:', error);
        return NextResponse.json({ error: 'Failed to fetch debts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { debtorName, startDate, initialAmount, currency, details } = body;

        const newDebt = await prisma.debt.create({
            data: {
                debtorName,
                startDate: new Date(startDate),
                initialAmount,
                currency: currency || 'USD',
                status: 'ACTIVE',
                details
            }
        });

        return NextResponse.json(newDebt);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create debt' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Debt ID required' }, { status: 400 });
        }

        // Delete payments first (cascade usually handles this but good to be safe/explicit if not configured)
        // Prisma schema usually cascades if configured, but let's just delete the Debt.
        await prisma.debtPayment.deleteMany({
            where: { debtId: id }
        });

        await prisma.debt.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting debt:', error);
        return NextResponse.json({ error: 'Failed to delete debt' }, { status: 500 });
    }
}
