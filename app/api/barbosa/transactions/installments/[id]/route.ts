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
            include: { user: true }
        });

        if (!plan || plan.user.email !== session.user?.email) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        return NextResponse.json(plan);
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
                    // Remove isStatistical logic from Plan if it doesn't exist in model, assuming it relies on Transactions
                    // But if it's not in the model, why was it in previous code?
                    // Checked Schema => BarbosaInstallmentPlan does NOT have isStatistical. BarbosaTransaction DOES.
                    // So we remove isStatistical from Plan update.
                }
            });

            // B. Regenerate Transactions if needed
            if (shouldRegenerate) {
                // Delete future/projected ones using CORRECT FIELD NAME
                await tx.barbosaTransaction.deleteMany({
                    where: {
                        installmentPlanId: id,
                        status: 'PROJECTED'
                    }
                });

                const amountPerInstallment = parseFloat(totalAmount) / count;

                // Simple regeneration logic:
                // We recreate ALL projected installments that don't overlap with existing REAL ones?
                // Or just regenerate the REMAINING ones?

                // Count existing REAL transactions
                const existingRealCount = await tx.barbosaTransaction.count({
                    where: {
                        installmentPlanId: id,
                        status: 'REAL'
                    }
                });

                const remainingToGenerate = count - existingRealCount;

                if (remainingToGenerate > 0) {
                    const start = new Date(startDate);

                    for (let i = 0; i < remainingToGenerate; i++) {
                        const installmentNumber = existingRealCount + i + 1; // e.g. 4, 5, 6
                        const txDate = new Date(start);
                        txDate.setMonth(start.getMonth() + (installmentNumber - 1));

                        await tx.barbosaTransaction.create({
                            data: {
                                userId: existingPlan.userId,
                                date: txDate,
                                type: 'EXPENSE',
                                categoryId,
                                subCategoryId: subCategoryId || null,
                                description: `${description} (${installmentNumber}/${count})`,
                                currency,
                                amount: amountPerInstallment,
                                status: 'PROJECTED', // Only generating future ones
                                isStatistical: isStatistical || false,
                                installmentPlanId: id,
                                comprobante: comprobante ? String(comprobante) : null
                            }
                        });
                    }
                }
            } else {
                // C. Updates WITHOUT regeneration
                await tx.barbosaTransaction.updateMany({
                    where: { installmentPlanId: id }, // CORRECT FIELD NAME
                    data: {
                        categoryId,
                        subCategoryId: subCategoryId || null,
                        isStatistical: isStatistical || false,
                        comprobante: comprobante ? String(comprobante) : null
                    }
                });

                // If Description changed, update numbering
                if (description !== existingPlan.description) {
                    const allTx = await tx.barbosaTransaction.findMany({
                        where: { installmentPlanId: id }, // CORRECT FIELD NAME
                        select: { id: true, description: true }
                    });

                    for (const t of allTx) {
                        const match = t.description?.match(/\(\d+\/\d+\)/); // description might be null? Schema says String?, so yes.
                        const numbering = match ? match[0] : '';
                        await tx.barbosaTransaction.update({
                            where: { id: t.id },
                            data: { description: `${description} ${numbering}`.trim() }
                        });
                    }
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
