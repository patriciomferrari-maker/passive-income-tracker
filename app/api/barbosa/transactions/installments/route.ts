
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
            status = 'PROJECTED',
            isStatistical = false
        } = body;

        const count = parseInt(installmentsCount);
        const value = parseFloat(amountValue);
        const start = new Date(startDate);

        if (isNaN(count) || count < 1) return NextResponse.json({ error: 'Invalid installments count' }, { status: 400 });
        if (isNaN(value) || value <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

        let amountPerQuota = 0;
        let totalPlanAmount = 0;

        if (amountMode === 'TOTAL') {
            amountPerQuota = value / count;
            totalPlanAmount = value;
        } else {
            amountPerQuota = value;
            totalPlanAmount = value * count;
        }

        // 1. Create the Installment Plan Record
        const plan = await prisma.barbosaInstallmentPlan.create({
            data: {
                userId,
                description,
                totalAmount: totalPlanAmount,
                currency,
                installmentsCount: count,
                startDate: start,
                categoryId,
                subCategoryId: subCategoryId || null
            }
        });

        // 2. Create Transactions linked to Plan
        // Prisma transaction for atomicity - We can do a massive createMany if possible, but we need date logic per row
        // So we prepared an array of promises or use $transaction with creates.
        const transactions = [];

        for (let i = 0; i < count; i++) {
            const quotaDate = new Date(start);
            quotaDate.setMonth(quotaDate.getMonth() + i);

            // Adjust day overflow (e.g. starting Jan 31 -> Feb 28)
            const targetMonth = start.getMonth() + i;
            const y = start.getFullYear() + Math.floor(targetMonth / 12);
            const m = targetMonth % 12; // 0-11

            const date = new Date(y, m, start.getDate());
            if (date.getMonth() !== m) {
                date.setDate(0); // Set to last day of previous month which is the target month end
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
                        status: status,
                        isStatistical: isStatistical,
                        installmentPlanId: plan.id
                    }
                })
            );
        }

        await prisma.$transaction(transactions);

        return NextResponse.json({ success: true, count: transactions.length, planId: plan.id });

    } catch (error: any) {
        console.error('Installments Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
