import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { regenerateContractCashflows } from '@/lib/rentals';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const contract = await prisma.contract.findUnique({
            where: { id },
            include: {
                property: true,
                rentalCashflows: {
                    orderBy: {
                        date: 'asc'
                    }
                }
            }
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        return NextResponse.json(contract);
    } catch (error) {
        console.error('Error fetching contract:', error);
        return NextResponse.json({ error: 'Failed to fetch contract' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const {
            tenantName,
            startDate,
            durationMonths,
            initialRent,
            currency,
            adjustmentType,
            adjustmentFrequency
        } = body;

        const contract = await prisma.contract.update({
            where: { id },
            data: {
                tenantName,
                startDate: new Date(new Date(startDate).setUTCHours(12, 0, 0, 0)),
                durationMonths: parseInt(durationMonths),
                initialRent: parseFloat(initialRent),
                currency,
                adjustmentType,
                adjustmentFrequency: parseInt(adjustmentFrequency)
            }
        });

        await regenerateContractCashflows(id);

        return NextResponse.json(contract);
    } catch (error) {
        console.error('Error updating contract:', error);
        return NextResponse.json({ error: 'Failed to update contract' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.contract.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting contract:', error);
        return NextResponse.json({ error: 'Failed to delete contract' }, { status: 500 });
    }
}
