import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';

export async function PUT(
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

        // Get transaction to find investment ID
        const transaction = await prisma.transaction.findUnique({
            where: { id }
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
                totalAmount: total
            }
        });

        // Regenerate cashflows for the investment
        const cashflows = await generateInvestmentCashflow(transaction.investmentId);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json(updatedTransaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}


export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log(`[API] DELETE transaction request for ID: ${id}`);

        // Get transaction to find investment ID
        const transaction = await prisma.transaction.findUnique({
            where: { id }
        });

        if (!transaction) {
            console.log(`[API] Transaction ${id} not found`);
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        const investmentId = transaction.investmentId;
        console.log(`[API] Found transaction ${id} for investment ${investmentId}`);

        // Delete transaction
        await prisma.transaction.delete({
            where: { id }
        });
        console.log(`[API] Transaction ${id} deleted`);

        // Regenerate cashflows for the investment
        console.log(`[API] Regenerating cashflows for investment ${investmentId}`);
        const cashflows = await generateInvestmentCashflow(investmentId);
        await saveInvestmentCashflows(cashflows);
        console.log(`[API] Cashflows regenerated`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error deleting transaction:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}
