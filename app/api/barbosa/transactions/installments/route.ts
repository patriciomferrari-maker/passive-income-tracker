
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

        // Duplicate Prevention: Check for recent identical plan (last 5 mins)
        const recentPlan = await prisma.barbosaInstallmentPlan.findFirst({
            where: {
                userId,
                description,
                totalAmount: totalPlanAmount,
                createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }
            }
        });

        if (recentPlan) {
            return NextResponse.json({ error: 'Duplicate plan detected. Please wait a moment.' }, { status: 409 });
        }


        // Atomic Transaction: Create Plan AND Transactions together
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the Installment Plan Record
            const plan = await tx.barbosaInstallmentPlan.create({
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
            for (let i = 0; i < count; i++) {
                // Determine Date Logic
                const quotaDate = new Date(start);
                // We use the same safe logic as before but simpler
                const targetMonth = start.getMonth() + i;
                const yearShift = Math.floor(targetMonth / 12);
                const month = targetMonth % 12; // 0-11
                // Date constructor with day overflow handling
                let date = new Date(start.getFullYear() + yearShift, month, start.getDate());

                // If overflow occurred (e.g. Jan 31 -> Feb 28/29 is desired, but Date goes to March 2/3),
                // check month mismatch.
                if (date.getMonth() !== month) {
                    // Set to last day of previous month = correct Month end
                    date = new Date(start.getFullYear() + yearShift, month + 1, 0);
                }

                await tx.barbosaTransaction.create({
                    data: {
                        userId,
                        date: date,
                        type: 'EXPENSE',
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
                });
            }

            return plan;
        });

        return NextResponse.json({ success: true, count: count, planId: result.id });

    } catch (error: any) {
        console.error('Installments Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
