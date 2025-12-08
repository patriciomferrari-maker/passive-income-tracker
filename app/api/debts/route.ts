import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();
        const debts = await prisma.debt.findMany({
            where: { userId },
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
        return unauthorized();
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { debtorName, startDate, initialAmount, currency, details } = body;

        const newDebt = await prisma.debt.create({
            data: {
                userId,
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
        return unauthorized();
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Debt ID required' }, { status: 400 });
        }

        // Verify ownership
        const existing = await prisma.debt.findFirst({ where: { id, userId } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Delete payments first (cascade usually handles this but good to be safe/explicit if not configured)
        await prisma.debtPayment.deleteMany({
            where: { debtId: id }
        });

        await prisma.debt.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting debt:', error);
        return unauthorized();
    }
}
