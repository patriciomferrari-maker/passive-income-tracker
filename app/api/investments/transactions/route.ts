import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET all transactions, optionally filtered by type
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        const whereClause = type
            ? { investment: { type } }
            : {}; // If no type specified, return all? Or default to ON? Let's default to all or handle logic.
        // Existing logic was hardcoded to ON. Let's make it dynamic.

        // If type is provided, use it. If not, maybe we should return all or default to ON for backward compatibility if needed?
        // But better to be explicit.

        const transactions = await prisma.transaction.findMany({
            where: type ? { investment: { type } } : { investment: { type: 'ON' } }, // Default to ON to match previous behavior if no param
            include: {
                investment: {
                    select: {
                        ticker: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
