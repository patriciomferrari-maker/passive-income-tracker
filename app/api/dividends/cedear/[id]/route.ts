import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET - Get single dividend
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getUserId();
        const { id } = await params;

        const dividend = await prisma.cedearDividend.findUnique({
            where: { id }
        });

        if (!dividend) {
            return NextResponse.json({ error: 'Dividend not found' }, { status: 404 });
        }

        return NextResponse.json(dividend);
    } catch (error) {
        console.error('Error fetching dividend:', error);
        return unauthorized();
    }
}

// PUT - Update dividend
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getUserId();
        const { id } = await params;
        const body = await request.json();

        const {
            ticker,
            companyName,
            announcementDate,
            paymentDate,
            recordDate,
            exDate,
            amount,
            currency,
            pdfUrl,
            notes
        } = body;

        const updateData: any = {};

        if (ticker !== undefined) updateData.ticker = ticker;
        if (companyName !== undefined) updateData.companyName = companyName;
        if (announcementDate !== undefined) updateData.announcementDate = new Date(announcementDate);
        if (paymentDate !== undefined) updateData.paymentDate = paymentDate ? new Date(paymentDate) : null;
        if (recordDate !== undefined) updateData.recordDate = recordDate ? new Date(recordDate) : null;
        if (exDate !== undefined) updateData.exDate = exDate ? new Date(exDate) : null;
        if (amount !== undefined) updateData.amount = amount ? parseFloat(amount) : null;
        if (currency !== undefined) updateData.currency = currency;
        if (pdfUrl !== undefined) updateData.pdfUrl = pdfUrl;
        if (notes !== undefined) updateData.notes = notes;

        const dividend = await prisma.cedearDividend.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(dividend);
    } catch (error: any) {
        console.error('Error updating dividend:', error);

        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Dividend not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Failed to update dividend' }, { status: 500 });
    }
}

// DELETE - Delete dividend
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await getUserId();
        const { id } = await params;

        await prisma.cedearDividend.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting dividend:', error);

        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Dividend not found' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Failed to delete dividend' }, { status: 500 });
    }
}
