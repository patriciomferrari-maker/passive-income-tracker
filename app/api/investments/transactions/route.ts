import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all transactions, optionally filtered by type
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const typeParam = searchParams.get('type');
        console.log(`[API] Fetching transactions for user ${userId}. Type Filter: ${typeParam}`);

        let typeFilter = {};

        if (typeParam) {
            const types = typeParam.split(',');
            if (types.length > 1) {
                typeFilter = { type: { in: types } };
            } else {
                typeFilter = { type: typeParam };
            }
        }

        const transactions = await prisma.transaction.findMany({
            where: {
                investment: {
                    userId, // Filter by User
                    ...typeFilter // Optional Type Filter
                }
            },
            include: {
                investment: {
                    select: {
                        ticker: true,
                        name: true,
                        type: true,
                        lastPrice: true
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
