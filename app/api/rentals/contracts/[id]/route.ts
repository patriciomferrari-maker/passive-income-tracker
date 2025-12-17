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
            adjustmentFrequency,
            documentUrl
        } = body;

        const parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) {
            return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
        }

        // Standardize to UTC Noon to avoid localized shifts
        const safeStartDate = new Date(Date.UTC(
            parsedStartDate.getUTCFullYear(),
            parsedStartDate.getUTCMonth(),
            parsedStartDate.getUTCDate(),
            12, 0, 0, 0
        ));

        const contract = await prisma.contract.update({
            where: { id },
            data: {
                tenantName,
                startDate: safeStartDate,
                durationMonths: parseInt(durationMonths),
                initialRent: parseFloat(initialRent),
                currency,
                adjustmentType,
                adjustmentFrequency: parseInt(adjustmentFrequency),
                documentUrl,
                warrantyAmount: body.warrantyAmount ? parseFloat(body.warrantyAmount) : null,
                warrantyCurrency: body.warrantyCurrency || 'USD'
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
