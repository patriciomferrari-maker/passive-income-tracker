
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            description,
            categoryId,
            subCategoryId,
            currency,
            startDate,
            installmentsCount,
            amountMode, // 'TOTAL' | 'INSTALLMENT'
            amountValue,
            status = 'PROJECTED'
        } = body;

        const count = parseInt(installmentsCount);
        const value = parseFloat(amountValue);
        const start = new Date(startDate);

        if (isNaN(count) || count < 1) return NextResponse.json({ error: 'Invalid installments count' }, { status: 400 });
        if (isNaN(value) || value <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

        let amountPerQuota = 0;
        if (amountMode === 'TOTAL') {
            amountPerQuota = value / count;
        } else {
            amountPerQuota = value;
        }

        // Create transactions in a transaction? Not strictly necessary but safer.
        // Prisma transaction for atomicity
        const transactions = [];

        for (let i = 0; i < count; i++) {
            const quotaDate = new Date(start);
            quotaDate.setMonth(quotaDate.getMonth() + i);

            // Adjust day overflow (e.g. Jan 31 + 1 month -> Feb 28/29)
            // default setMonth behaviour mostly handles this, clamping to last day if overflow?
            // Actually JS setMonth(currentMonth + 1) on Jan 31 results in March 3 or 2 usually if Feb is short.
            // Let's use a safer approach for "Next Month same Day".
            // If day is > 28, we should be careful.
            // Simple approach: Date(start.getFullYear(), start.getMonth() + i, start.getDate())
            // But if start is Jan 31, and we do Feb, it becomes March 3.
            // Typically installments keep the "Day of Month" or clamp to last day.
            // Let's implement clamp logic.

            const targetMonth = start.getMonth() + i;
            const y = start.getFullYear() + Math.floor(targetMonth / 12);
            const m = targetMonth % 12;
            const d = start.getDate();

            const date = new Date(y, m, d);
            if (date.getMonth() !== m) {
                // Overflowed, set to last day of intended month
                date.setDate(0);
            }

            transactions.push(
                prisma.barbosaTransaction.create({
                    data: {
                        userId,
                        date: date,
                        type: 'EXPENSE', // Installments are usually expenses
                        amount: amountPerQuota,
                        currency,
                        amountUSD: currency === 'USD' ? amountPerQuota : null,
                        categoryId,
                        subCategoryId: subCategoryId || null,
                        description: `${description} (${i + 1}/${count})`,
                        status: status
                    }
                })
            );
        }

        await prisma.$transaction(transactions);

        return NextResponse.json({ success: true, count: transactions.length });

    } catch (error: any) {
        console.error('Installments Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
