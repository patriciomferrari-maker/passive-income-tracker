import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
        }

        const result = await prisma.barbosaTransaction.deleteMany({
            where: {
                id: { in: ids },
                userId // Security check
            }
        });

        // Cleanup: Delete plans with no transactions left
        await prisma.barbosaInstallmentPlan.deleteMany({
            where: {
                userId,
                transactions: {
                    none: {}
                }
            }
        });

        return NextResponse.json({ count: result.count });
    } catch (error) {
        console.error('Error batch deleting transactions:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
