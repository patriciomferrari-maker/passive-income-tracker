import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateContractCashflows } from '@/lib/rentals';

export async function GET() {
    try {
        const contracts = await prisma.contract.findMany({
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
        return NextResponse.json({ error: 'Failed to fetch contracts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            propertyId,
            tenantName,
            startDate,
            durationMonths,
            initialRent,
            currency,
            adjustmentType,
            adjustmentFrequency
        } = body;

        const contract = await prisma.contract.create({
            data: {
                propertyId,
                tenantName,
                startDate: new Date(new Date(startDate).setUTCHours(12, 0, 0, 0)),
                durationMonths: parseInt(durationMonths),
                initialRent: parseFloat(initialRent),
                currency,
                adjustmentType,
                adjustmentFrequency: parseInt(adjustmentFrequency)
            }
        });

        const cashflows = await generateContractCashflows(contract);

        await prisma.rentalCashflow.createMany({
            data: cashflows
        });

        return NextResponse.json({ contract, cashflowsGenerated: cashflows.length });
    } catch (error) {
        console.error('Error creating contract:', error);
        return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
    }
}
