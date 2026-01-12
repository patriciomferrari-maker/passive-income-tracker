
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
            isStatistical = false,
            comprobante = null
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
        // OR if a transaction with the same COMPROBANTE already exists
        const isVoucherValid = comprobante && String(comprobante).length > 2 && !String(comprobante).includes('$');

        if (isVoucherValid) {
            const existingTx = await prisma.barbosaTransaction.findFirst({
                where: { userId, comprobante: String(comprobante) }
            });
            if (existingTx) {
                return NextResponse.json({
                    error: 'DUPLICATE',
                    message: `Ya existe una transacción con el comprobante ${comprobante}.`
                }, { status: 409 });
            }
        }

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
                // Parse start date parts
                const [y, m, d] = startDate.split('-').map(Number);
                // Create Base Date at 12:00 UTC
                // Month is 0-indexed in JS Date/UTC
                let date = new Date(Date.UTC(y, m - 1 + i, d, 12, 0, 0));

                // Handle Overflow (e.g. Jan 31 + 1 month -> Feb 31 doesn't exist)
                // If we land on a different month or different day than expected due to overflow
                // But JS Date auto-corrects Feb 31 to Mar 3/2. We want to clamp to last day of Feb.
                // Re-check:
                // We want: Y, M+i.
                const targetMonthIndex = m - 1 + i;
                const targetY = y + Math.floor(targetMonthIndex / 12);
                const targetM = targetMonthIndex % 12; // 0-11

                // If date.getUTCMonth() !== targetM, we overflowed.
                // date will be in next month. Set to day 0 of date's month -> Last day of previous (target) month.
                if (date.getUTCMonth() !== targetM && targetM >= 0) {
                    date = new Date(Date.UTC(targetY, targetM + 1, 0, 12, 0, 0));
                } else if (date.getUTCMonth() !== (targetM < 0 ? 12 + targetM : targetM)) {
                    // Handle negative modulo logic if needed, though here i >= 0 so targetMonthIndex >= m-1
                    // Just simple clamp: set to 12:00 UTC of last day of target month
                    date = new Date(Date.UTC(targetY, targetM + 1, 0, 12, 0, 0));
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
                        installmentPlanId: plan.id,
                        comprobante: comprobante ? String(comprobante) : null
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
