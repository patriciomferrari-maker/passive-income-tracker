import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateContractCashflows } from '@/lib/rentals';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();
        const contracts = await prisma.contract.findMany({
            where: {
                property: {
                    userId // Filter by property ownership
                }
            },
            include: {
                property: true
            },
            orderBy: {
                startDate: 'desc'
            }
        });

        return NextResponse.json(contracts);
    } catch (error) {
        console.error('Error fetching contracts:', error);
        // Log detailed error for debugging
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Stack:', error.stack);
        }
        return unauthorized();
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const {
            propertyId,
            tenantName,
            startDate,
            durationMonths,
            initialRent,
            currency,
            adjustmentType,
            adjustmentFrequency,
            documentUrl,
            warrantyAmount,
            warrantyCurrency
        } = body;

        // Verify property ownership
        const property = await prisma.property.findFirst({
            where: { id: propertyId, userId }
        });
        if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

        const contract = await prisma.contract.create({
            data: {
                propertyId,
                tenantName,
                startDate: new Date(new Date(startDate).setUTCHours(12, 0, 0, 0)),
                durationMonths: parseInt(durationMonths),
                initialRent: parseFloat(initialRent),
                currency,
                adjustmentType,
                adjustmentFrequency: parseInt(adjustmentFrequency),
                documentUrl,
                warrantyAmount: warrantyAmount ? parseFloat(warrantyAmount) : null,
                warrantyCurrency: warrantyCurrency || 'USD'
            }
        });

        const cashflows = await generateContractCashflows(contract);

        await prisma.rentalCashflow.createMany({
            data: cashflows
        });

        return NextResponse.json({ contract, cashflowsGenerated: cashflows.length });
    } catch (error) {
        console.error('Error creating contract:', error);
        return unauthorized();
    }
}
