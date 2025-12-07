import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateInvestmentCashflow, saveInvestmentCashflows } from '@/lib/investments';

// GET specific ON
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const investment = await prisma.investment.findUnique({
            where: { id },
            include: {
                amortizationSchedules: {
                    orderBy: { paymentDate: 'asc' }
                },
                transactions: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!investment) {
            return NextResponse.json({ error: 'ON not found' }, { status: 404 });
        }

        return NextResponse.json(investment);
    } catch (error) {
        console.error('Error fetching ON:', error);
        return NextResponse.json({ error: 'Failed to fetch ON' }, { status: 500 });
    }
}

// PUT update ON
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, emissionDate, couponRate, frequency, maturityDate, amortization, amortizationSchedules } = body;

        // Delete existing schedules if switching to/from PERSONALIZADA
        if (amortization) {
            await prisma.amortizationSchedule.deleteMany({
                where: { investmentId: id }
            });
        }

        const investment = await prisma.investment.update({
            where: { id },
            data: {
                name,
                emissionDate: emissionDate ? new Date(emissionDate) : null,
                couponRate: couponRate ? parseFloat(couponRate) : null,
                frequency: frequency ? parseInt(frequency) : null,
                maturityDate: maturityDate ? new Date(maturityDate) : null,
                amortization: amortization || 'BULLET',
                amortizationSchedules: amortizationSchedules && amortization === 'PERSONALIZADA' ? {
                    create: amortizationSchedules.map((schedule: any) => ({
                        paymentDate: new Date(schedule.paymentDate),
                        percentage: parseFloat(schedule.percentage)
                    }))
                } : undefined
            },
            include: {
                amortizationSchedules: true
            }
        });

        // Regenerate cashflows
        const cashflows = await generateInvestmentCashflow(id);
        await saveInvestmentCashflows(cashflows);

        return NextResponse.json(investment);
    } catch (error) {
        console.error('Error updating ON:', error);
        return NextResponse.json({ error: 'Failed to update ON' }, { status: 500 });
    }
}

// DELETE ON
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Delete related records first to avoid foreign key constraint violations
        // Delete cashflows
        await prisma.cashflow.deleteMany({
            where: { investmentId: id }
        });

        // Delete transactions
        await prisma.transaction.deleteMany({
            where: { investmentId: id }
        });

        // Delete amortization schedules
        await prisma.amortizationSchedule.deleteMany({
            where: { investmentId: id }
        });

        // Now delete the investment
        await prisma.investment.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting ON:', error);
        return NextResponse.json({ error: 'Failed to delete ON' }, { status: 500 });
    }
}
