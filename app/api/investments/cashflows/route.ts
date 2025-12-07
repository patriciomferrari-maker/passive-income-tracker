import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'ON'; // Default to ON for backward compatibility

        // Only get cashflows for investments that have at least one transaction
        const cashflows = await prisma.cashflow.findMany({
            where: {
                status: 'PROJECTED',
                investment: {
                    type: type,
                    transactions: {
                        some: {}
                    }
                }
            },
            orderBy: { date: 'asc' }
        });

        // Aggregate by month (not by exact date)
        const aggregated = cashflows.reduce((acc, curr) => {
            const date = new Date(curr.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

            if (!acc[monthKey]) {
                acc[monthKey] = {
                    date: new Date(monthKey),
                    amount: 0,
                    interest: 0,
                    amortization: 0
                };
            }
            acc[monthKey].amount += curr.amount;
            if (curr.type === 'INTEREST') {
                acc[monthKey].interest += curr.amount;
            } else {
                acc[monthKey].amortization += curr.amount;
            }
            return acc;
        }, {} as Record<string, any>);

        return NextResponse.json(Object.values(aggregated));
    } catch (error) {
        console.error('Error fetching consolidated cashflows:', error);
        return NextResponse.json({ error: 'Failed to fetch cashflows' }, { status: 500 });
    }
}
