import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const plan = await prisma.barbosaInstallmentPlan.findUnique({
            where: { id: params.id },
            include: {
                user: true,
                transactions: {
                    select: { isStatistical: true, comprobante: true },
                    take: 1
                }
            }
        });

        if (!plan || plan.user.email !== session.user?.email) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        // Add computed fields from transactions
        const enhancedPlan = {
            ...plan,
            isStatistical: plan.transactions[0]?.isStatistical || false,
            comprobante: plan.transactions[0]?.comprobante || null
        };

        return NextResponse.json(enhancedPlan);
    } catch (error) {
        console.error("Error fetching plan:", error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { id } = params;
        let {
            description,
            categoryId,
            subCategoryId,
            totalAmount,
            installmentsCount,
            startDate,
            currency,
            amountMode, // 'TOTAL' | 'INSTALLMENT'
            amountValue, // The raw input value
            status, // 'PROJECTED' | 'REAL'
            isStatistical,
            comprobante
        } = body;

        // Ensure numeric values
        const count = parseInt(installmentsCount);
        const value = parseFloat(amountValue);

        // Robust Calculation: If totalAmount is missing or potentially stale, recalculate it
        if (amountMode && !isNaN(value)) {
            if (amountMode === 'TOTAL') {
                totalAmount = value;
            } else {
                totalAmount = value * count;
            }
        } else if (!totalAmount) {
            // Fallback if no amount data
            totalAmount = 0;
        }

        // 1. Fetch existing plan to verify ownership and compare state
        const existingPlan = await prisma.barbosaInstallmentPlan.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!existingPlan || existingPlan.user.email !== session.user?.email) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        // 2. Logic Check: Do we need to regenerate transactions?
        let shouldRegenerate = false;

        const newStartDate = new Date(startDate).toISOString().split('T')[0];
        const oldStartDate = existingPlan.startDate.toISOString().split('T')[0];

        if (
            existingPlan.installmentsCount !== count ||
            Math.abs(existingPlan.totalAmount - parseFloat(totalAmount)) > 0.01 ||
            oldStartDate !== newStartDate ||
            existingPlan.currency !== currency
        ) {
            shouldRegenerate = true;
        }

        // 3. Atomic Transaction
        await prisma.$transaction(async (tx) => {
            // A. Update Plan Header
            await tx.barbosaInstallmentPlan.update({
                where: { id },
                data: {
                    description,
                    categoryId,
                    subCategoryId: subCategoryId || null,
                    totalAmount: parseFloat(totalAmount),
                    installmentsCount: count,
                    startDate: new Date(startDate),
                    currency,
                }
            });

            // B. Sync All Transactions (Past + Future)
            // Fetch existing sorted by date
            const existingTxs = await tx.barbosaTransaction.findMany({
                where: { installmentPlanId: id },
                orderBy: { date: 'asc' }
            });

            const amountPerInstallment = parseFloat(totalAmount) / count;
            const start = new Date(startDate);

            // Loop through the NEW count
            for (let i = 0; i < count; i++) {
                // Calculate Target Date for this quota
                const targetDate = new Date(start);
                targetDate.setMonth(start.getMonth() + i);

                // Adjust day if month length differs (e.g. Jan 31 -> Feb 28)
                const originalDay = start.getDate();
                if (targetDate.getDate() !== originalDay) {
                    targetDate.setDate(0); // Last day of previous month = correct Month end
                }

                const desc = `${description} (${i + 1}/${count})`;
                const commonData = {
                    date: targetDate,
                    amount: amountPerInstallment,
                    amountUSD: currency === 'USD' ? amountPerInstallment : null,
                    description: desc,
                    categoryId,
                    subCategoryId: subCategoryId || null,
                    currency,
                    isStatistical: isStatistical || false,
                    // If comprobante is provided, update it for all. Else keep existing (controlled by separate update below for creates)
                    // Actually, let's just use the one from payload if present.
                };

                // If existing transaction at this index, UPDATE it
                if (i < existingTxs.length) {
                    const t = existingTxs[i];
                    await tx.barbosaTransaction.update({
                        where: { id: t.id },
                        data: {
                            ...commonData,
                            // Preserve STATUS and related fields
                            // We do NOT update status.
                            // We do update comprobante if new one provided?
                            comprobante: comprobante ? String(comprobante) : t.comprobante
                        }
                    });
                } else {
                    // CREATE new projected transaction
                    await tx.barbosaTransaction.create({
                        data: {
                            ...commonData,
                            userId: existingPlan.userId,
                            installmentPlanId: id,
                            type: 'EXPENSE',
                            status: 'PROJECTED',
                            comprobante: comprobante ? String(comprobante) : null
                        }
                    });
                }
            }

            // C. Delete Excess Transactions (if count reduced)
            if (existingTxs.length > count) {
                const toDelete = existingTxs.slice(count);
                if (toDelete.length > 0) {
                    await tx.barbosaTransaction.deleteMany({
                        where: {
                            id: { in: toDelete.map(t => t.id) }
                        }
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating plan:", error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = params;
        const plan = await prisma.barbosaInstallmentPlan.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!plan || plan.user.email !== session.user?.email) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.barbosaTransaction.deleteMany({
                where: { installmentPlanId: id } // CORRECT FIELD NAME
            });
            await tx.barbosaInstallmentPlan.delete({
                where: { id }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting plan:", error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
