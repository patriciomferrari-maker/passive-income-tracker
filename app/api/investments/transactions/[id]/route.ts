import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        const transaction = await prisma.transaction.findFirst({
            where: {
                id,
                investment: { userId }
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        return unauthorized();
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;
        const body = await request.json();
        const { date, quantity, price, commission, currency } = body;

        const qty = parseFloat(quantity);
        const prc = parseFloat(price);
        const comm = parseFloat(commission);
        const total = -(qty * prc + comm);

        // Get transaction to find investment ID and verify ownership
        const transaction = await prisma.transaction.findFirst({
            where: {
                id,
                investment: { userId } // Check Ownership
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Update transaction
        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: {
                date: new Date(date),
                quantity: qty,
                price: prc,
                commission: comm,
                totalAmount: total,
                currency: currency || transaction.currency // Update currency if provided, else keep existing
            }
        });

        // Regenerate cashflows for the investment
        const cashflows = await generateInvestmentCashflow(transaction.investmentId);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        return unauthorized();
    }
}


export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Get transaction to find investment ID and verify ownership
        const transaction = await prisma.transaction.findFirst({
            where: {
                id,
                investment: { userId } // Check Ownership
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const investmentId = transaction.investmentId;

        // Delete transaction
        await prisma.transaction.delete({
            where: { id }
        });

        // Regenerate cashflows for the investment
        const cashflows = await generateInvestmentCashflow(investmentId);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting transaction:', error);
        return unauthorized();
    }
}
