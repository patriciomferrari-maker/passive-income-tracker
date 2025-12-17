
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { sourceMonth, sourceYear, targetMonth, targetYear } = await req.json();

        // 1. Fetch Source Transactions
        const startDate = new Date(sourceYear, sourceMonth - 1, 1);
        const endDate = new Date(sourceYear, sourceMonth, 0, 23, 59, 59);

        const txs = await prisma.barbosaTransaction.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate }
            }
        });

        if (txs.length === 0) {
            return NextResponse.json({ message: 'No transactions found in source month' }, { status: 400 });
        }

        let createdCount = 0;

        // 2. Clone Loop
        for (const tx of txs) {
            // Calculate new date
            const day = tx.date.getDate();
            // Validate day for target month (e.g. 31st Jan -> 28th Feb?)
            const targetDate = new Date(targetYear, targetMonth - 1, day);

            // Adjust rollback if month overflowed (e.g. Feb 30 -> Mar 2)
            if (targetDate.getMonth() !== targetMonth - 1) {
                targetDate.setDate(0); // Set to last day of previous month = correct last day of target month
            }

            await prisma.barbosaTransaction.create({
                data: {
                    userId,
                    date: targetDate,
                    type: tx.type,
                    amount: tx.amount,
                    currency: tx.currency,
                    exchangeRate: tx.exchangeRate,
                    amountUSD: tx.amountUSD,
                    categoryId: tx.categoryId,
                    subCategoryId: tx.subCategoryId,
                    description: `(Proyectado) ${tx.description || ''}`,
                    status: 'PROJECTED'
                }
            });
            createdCount++;
        }

        return NextResponse.json({ success: true, count: createdCount });

    } catch (error: any) {
        console.error('Clone Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
