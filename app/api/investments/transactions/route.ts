import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all transactions, optionally filtered by type
export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId, // Filter by User
                    ...(type && { type }) // Optional Type Filter
                }
            },
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
        return unauthorized();
    }
}
