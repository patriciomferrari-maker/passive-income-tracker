import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { regenerateContractCashflows } from '@/lib/rentals';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // 1. Fetch Contract to get start date and currency, AND verify ownership
        const contract = await prisma.contract.findUnique({
            where: { id },
            select: {
                startDate: true,
                currency: true,
                property: {
                    select: { userId: true }
                }
            }
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        if (contract.property.userId !== userId) {
            return unauthorized();
        }

        // 2. Fetch Cashflows
        const cashflows = await prisma.rentalCashflow.findMany({
            where: { contractId: id },
            orderBy: { date: 'asc' }
        });

        // Return cashflows directly from DB (Single Source of Truth)
        // Adjust dates to Noon UTC for consistent frontend display
        const fixedDateCashflows = cashflows.map(cf => {
            const d = new Date(cf.date);
            return {
                ...cf,
                date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0)).toISOString()
            };
        });

        return NextResponse.json(fixedDateCashflows);
    } catch (error) {
        console.error('Error fetching contract cashflows:', error);
        return unauthorized();
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getUserId();
        const { id } = await params;

        // Verify ownership
        const contract = await prisma.contract.findUnique({
            where: { id },
            select: { property: { select: { userId: true } } }
        });

        if (!contract || contract.property.userId !== userId) {
            return unauthorized();
        }

        const cashflows = await regenerateContractCashflows(id);

        return NextResponse.json(cashflows);
    } catch (error) {
        console.error('Error regenerating cashflows:', error);
        return NextResponse.json({ error: 'Failed to regenerate cashflows' }, { status: 500 });
    }
}
