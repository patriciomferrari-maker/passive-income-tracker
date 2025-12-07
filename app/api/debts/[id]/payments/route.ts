import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const payments = await prisma.debtPayment.findMany({
            where: {
                debtId: params.id
            },
            orderBy: {
                date: 'desc'
            }
        });

        return NextResponse.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const body = await request.json();
        const { amount, date, description, type } = body;

        const createData: any = {
            debt: {
                connect: { id: params.id }
            },
            amount: parseFloat(amount),
            date: new Date(date),
            description,
        };

        console.log(`DEBUG: Received type '${type}', comparison with PAYMENT: ${type === 'PAYMENT'}`);

        // WORKAROUND: Only include 'type' if it differs from default 'PAYMENT'.
        if (type && type.trim() !== 'PAYMENT') {
            createData.type = type;
        } else {
            console.log('DEBUG: Omitting type field');
        }

        const newPayment = await prisma.debtPayment.create({
            data: createData
        });

        return NextResponse.json(newPayment);
    } catch (error) {
        console.error('Error creating payment:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error
        }, { status: 500 });
    }
}
