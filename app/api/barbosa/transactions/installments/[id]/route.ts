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
        const {
            description,
            categoryId,
            subCategoryId,
            totalAmount, // This might be recalculated if user changed installments/amount
            installmentsCount,
            startDate,
            currency,
            amountMode, // 'TOTAL' | 'INSTALLMENT'
            amountValue, // The raw input value
            status, // 'PROJECTED' | 'REAL'
            isStatistical
        } = body;

        // 1. Fetch existing plan to verify ownership and compare state
        const existingPlan = await prisma.barbosaInstallmentPlan.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!existingPlan || existingPlan.user.email !== session.user?.email) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        // 2. Logic Check: Do we need to regenerate transactions?
        // Regenerate if structural fields change: Count, Amount, StartDate, Currency
        // OR if status changes from PROJECTED <-> REAL (though usually we just update status)

        let shouldRegenerate = false;

        // Simple comparison. Note: Dates need care.
        const newStartDate = new Date(startDate).toISOString().split('T')[0];
        const oldStartDate = existingPlan.startDate.toISOString().split('T')[0];

        if (
            existingPlan.installmentsCount !== parseInt(installmentsCount) ||
            Math.abs(existingPlan.totalAmount - parseFloat(totalAmount)) > 0.01 || // floating point tolerance
            oldStartDate !== newStartDate ||
            existingPlan.currency !== currency
        ) {
            shouldRegenerate = true;
        }

        // 3. Transactions Transaction
        await prisma.$transaction(async (tx) => {
            // A. Update Plan Header
            await tx.barbosaInstallmentPlan.update({
                where: { id },
                data: {
                    description,
                    categoryId,
                    subCategoryId: subCategoryId || null,
                    totalAmount: parseFloat(totalAmount),
                    installmentsCount: parseInt(installmentsCount),
                    startDate: new Date(startDate),
                    currency,
                    isStatistical: isStatistical || false
                }
            });

            // B. Regenerate Transactions if needed
            // Strategy: Delete ONLY 'PROJECTED' transactions belonging to this plan.
            // Keep 'REAL' transactions as they represent actual payments made.
            // If the user wants to fully reset, they should probably delete and recreate, but here we try to be smart.

            if (shouldRegenerate) {
                // Delete future/projected ones
                await tx.barbosaTransaction.deleteMany({
                    where: {
                        installmentsPlanId: id,
                        status: 'PROJECTED'
                    }
                });

                // Calculate amounts
                const count = parseInt(installmentsCount);
                const total = parseFloat(totalAmount);
                const amountPerInstallment = total / count;

                // We need to know how many 'REAL' transactions already exist to avoid creating duplicates or "extra" installments if we strictly follow the count.
                // However, a simpler approach for now is:
                // If we regenerate, we are likely changing the FUTURE plan.
                // But if the count changed from 12 to 6, and we already paid 3, we should only generate 3 more.

                // Let's count existing REAL transactions
                const existingRealCount = await tx.barbosaTransaction.count({
                    where: {
                        installmentsPlanId: id,
                        status: 'REAL'
                    }
                });

                const remainingToGenerate = count - existingRealCount;

                if (remainingToGenerate > 0) {
                    const start = new Date(startDate);
                    // We need to offset the start date by the number of ALREADY existing installments (real + the ones we just deleted)
                    // Actually, simpler: Generate the full 1..N installments.
                    // Check if installment #K already exists as REAL. If so, skip. If not, create PROJECTED.
                    // This assumes "installment number" logic, but we don't strictly store "installment number 3 of 12" in a dedicated field (we rely on date/order).

                    // ALTERNATIVE SIMPLER LOGIC for MVP:
                    // Just generating 'remainingToGenerate' starting from (Start Date + existingRealCount months).

                    for (let i = 0; i < remainingToGenerate; i++) {
                        const installmentNumber = existingRealCount + i + 1; // e.g. 4, 5, 6
                        const txDate = new Date(start);
                        txDate.setMonth(start.getMonth() + (installmentNumber - 1));

                        // Check if a transaction for this "slot" already exists? 
                        // It's hard to match exactly without an index.
                        // Let's trust the "Delete Many Projected" + "Create New Projected" approach.

                        await tx.barbosaTransaction.create({
                            data: {
                                userId: existingPlan.userId,
                                date: txDate,
                                type: 'EXPENSE',
                                categoryId,
                                subCategoryId: subCategoryId || null,
                                description: `${description} (${installmentNumber}/${count})`,
                                currency,
                                amount: amountPerInstallment, // Use strict division
                                status: status === 'REAL' ? 'REAL' : 'PROJECTED', // If user set global status to REAL, we create REAL. Else PROJECTED.
                                isStatistical: isStatistical || false,
                                installmentsPlanId: id
                            }
                        });
                    }
                }
            } else {
                // C. Updates WITHOUT regeneration (just metadata like desc/category)
                // We should update the associated transactions too!
                await tx.barbosaTransaction.updateMany({
                    where: { installmentsPlanId: id },
                    data: {
                        description: {
                            // Complex: We can't easily do a regex replace in Prisma.
                            // We might overwrite the "(x/y)" part if we are not careful.
                            // For MVP: Let's NOT update description of transactions to avoid losing the "(1/12)" marker.
                            // OR: fetching and updating one by one? Too heavy.
                            // Let's just update Category/SubCategory/IsStatistical
                        },
                        categoryId,
                        subCategoryId: subCategoryId || null,
                        isStatistical: isStatistical || false
                    }
                });

                // If Description changed, we might want to update it.
                if (description !== existingPlan.description) {
                    // Fetch all and update manually to preserve numbering
                    const allTx = await tx.barbosaTransaction.findMany({
                        where: { installmentsPlanId: id },
                        select: { id: true, description: true }
                    });

                    for (const t of allTx) {
                        // Try to preserve numbering: "Old Desc (1/12)" -> "New Desc (1/12)"
                        const match = t.description.match(/\(\d+\/\d+\)/);
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

        // Delete plan (Cascade should facilitate deleting transactions if configured, 
        // but explicit transaction delete is safer/cleaner to ensure consistency if schema differs)
        // Schema usually has cascade on transactions -> installmentsPlanId.
        // Let's rely on Prisma Cascade if defined, or delete transactions first.

        await prisma.$transaction(async (tx) => {
            await tx.barbosaTransaction.deleteMany({
                where: { installmentsPlanId: id }
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
