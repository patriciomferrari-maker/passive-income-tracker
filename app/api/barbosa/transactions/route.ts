import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const whereClause: any = { userId };

    if (month && year) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        whereClause.date = {
            gte: startDate,
            lte: endDate
        };
    }

    const txs = await prisma.barbosaTransaction.findMany({
        where: whereClause,
        include: {
            category: true,
            subCategory: true
        },
        orderBy: { date: 'desc' }
    });

    return NextResponse.json(txs);
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
        date,
        amount,
        currency,
        categoryId,
        subCategoryId,
        type,
        description,
        exchangeRate,
        status,
        isStatistical,
        isInstallmentPlan, // boolean
        installments       // { current: number, total: number }
    } = body;

    // 1. Validate Category
    let validCategoryId = categoryId;
    let category = null;

    if (validCategoryId) {
        // Verify it belongs to user
        category = await prisma.barbosaCategory.findFirst({
            where: { id: validCategoryId, userId }
        });
    }

    // Fallback: If no category provided or found, look for "General" or create it
    if (!category) {
        console.log('[API] No valid category provided, looking for default "General"');
        category = await prisma.barbosaCategory.findFirst({
            where: { userId, name: 'General', type: 'EXPENSE' }
        });

        if (!category) {
            console.log('[API] "General" category not found, creating it...');
            category = await prisma.barbosaCategory.create({
                data: {
                    userId,
                    name: 'General',
                    type: 'EXPENSE'
                }
            });
        }
        validCategoryId = category.id;
    }

    // 2. Validate SubCategory (if provided)
    let validSubCategoryId = null;
    if (subCategoryId) {
        const subCategory = await prisma.barbosaSubCategory.findFirst({
            where: { id: subCategoryId, categoryId: validCategoryId }
        });
        if (subCategory) {
            validSubCategoryId = subCategory.id;
        }
    }

    // 3. Handle Installment Plan Creation
    let installmentPlanId = null;

    if (isInstallmentPlan && installments && installments.total > 1) {
        // Calculate THE REAL Start Date of the plan (Month 1)
        // If we are importing "Cuota 5/12" on Aug 2025, Start (1/12) was April 2025.
        const currentQuota = installments.current || 1;

        const trueStartDate = new Date(date);
        trueStartDate.setMonth(trueStartDate.getMonth() - (currentQuota - 1));

        console.log(`[API] Creating Installment Plan (Total: ${installments.total}). Current: ${currentQuota}. Start Date: ${trueStartDate.toISOString()}`);

        const plan = await prisma.barbosaInstallmentPlan.create({
            data: {
                userId,
                description: description || 'Compra en cuotas',
                totalAmount: parseFloat(amount) * installments.total,
                currency,
                installmentsCount: installments.total,
                startDate: trueStartDate,
                categoryId: validCategoryId,
                subCategoryId: validSubCategoryId
            }
        });
        installmentPlanId = plan.id;

        // Create Future Projected Transactions (Any installment > current)
        // AND ALSO Past Projected Transactions? No, user only cares about future usually. 
        // But for completeness, we might want to fill gaps? 
        // For now, let's stick to FUTURE projections as per previous logic, 
        // BUT we must base the loop on the trueStartDate to align correctly.

        // Actually, the previous logic was: loop remaining (current+1 to total).
        // That is still valid for creating PROJECTED rows.
        const remaining = installments.total - currentQuota;

        if (remaining > 0) {
            console.log(`[API] Generating ${remaining} future installments...`);
            const promises = [];

            // Loop for FUTURE installments
            for (let i = 1; i <= remaining; i++) {
                const nextQuotaNum = currentQuota + i;
                const nextDate = new Date(date); // Base on CURRENT date
                nextDate.setMonth(nextDate.getMonth() + i);

                // Keep day of month, handle rollover
                if (date.substring(8, 10) !== nextDate.toISOString().substring(8, 10)) {
                    // Simple check if day changed due to month length diff
                    // Actually better: use Date object logic but check day mismatch
                    const originalDay = new Date(date).getDate();
                    if (nextDate.getDate() !== originalDay) {
                        nextDate.setDate(0); // Set to last day of previous month = end of target month
                    }
                }

                promises.push(prisma.barbosaTransaction.create({
                    data: {
                        userId,
                        date: nextDate,
                        amount: parseFloat(amount),
                        currency,
                        type: 'EXPENSE',
                        description: `${description} (Cuota ${nextQuotaNum}/${installments.total})`,
                        categoryId: validCategoryId,
                        subCategoryId: validSubCategoryId,
                        status: 'PROJECTED',
                        isStatistical: isStatistical || false,
                        installmentPlanId: plan.id
                    }
                }));
            }
            await Promise.all(promises);
        }
    }

    // 4. Create the MAIN Transaction (The one being imported currently)
    const tx = await prisma.barbosaTransaction.create({
        data: {
            userId,
            date: new Date(date),
            amount: parseFloat(amount),
            currency,
            type,
            exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
            amountUSD: currency === 'USD' ? parseFloat(amount) : (exchangeRate ? parseFloat(amount) / parseFloat(exchangeRate) : null),
            description: description, // Should already include (Cuota X/Y) from frontend parsing
            categoryId: validCategoryId,
            subCategoryId: validSubCategoryId,
            status: status || 'REAL',
            isStatistical: isStatistical || false,
            installmentPlanId: installmentPlanId // Link if created
        },
        include: {
            category: true,
            subCategory: true
        }
    });

    // --- COSTA SYNC LOGIC ---
    if (category.name.toLowerCase().includes('costa')) {
        try {
            console.log('Syncing to Costa module...');
            let targetCategoryName = 'Varios';
            if (validSubCategoryId) {
                const subCatObj = await prisma.barbosaSubCategory.findUnique({ where: { id: validSubCategoryId } });
                if (subCatObj) targetCategoryName = subCatObj.name;
            } else {
                targetCategoryName = 'General';
            }

            let costaCategory = await prisma.costaCategory.findFirst({
                where: { userId, name: targetCategoryName, type: 'EXPENSE' }
            });

            if (!costaCategory) {
                costaCategory = await prisma.costaCategory.create({
                    data: { userId, name: targetCategoryName, type: 'EXPENSE' }
                });
            }

            await prisma.costaTransaction.create({
                data: {
                    userId,
                    date: new Date(date),
                    type: 'EXPENSE',
                    amount: parseFloat(amount),
                    currency,
                    description: description || `Sync desde Barbosa (${category.name})`,
                    categoryId: costaCategory.id,
                    linkedTransactionId: tx.id
                }
            });
            console.log('Costa Sync successful.');
        } catch (error) {
            console.error('Error syncing to Costa:', error);
        }
    }
    // ------------------------

    return NextResponse.json(tx);
}
