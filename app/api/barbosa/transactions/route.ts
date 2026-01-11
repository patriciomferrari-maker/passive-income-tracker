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
    console.log(`[API] POST /api/barbosa/transactions - Received:`, JSON.stringify(body, null, 2));
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
        isInstallmentPlan,
        installments,
        comprobante       // Receipt/Voucher number
    } = body;

    // 0. Duplicate Detection
    // We check for duplicates based on Voucher (if provided and long enough) OR (Date + Amount + Voucher)
    const isVoucherValid = comprobante && comprobante.length > 2 && !comprobante.includes('$');

    if (isVoucherValid || (date && amount)) {
        const existing = await prisma.barbosaTransaction.findFirst({
            where: {
                userId,
                date: new Date(date),
                amount: parseFloat(amount),
                comprobante: comprobante || null
            }
        });

        if (existing) {
            console.log(`[API] Duplicate transaction skipped: ${description} (${date}, ${amount})`);
            return NextResponse.json({
                error: 'DUPLICATE',
                message: `La transacción "${description}" del ${date} por ${amount} ya existe.`,
                transaction: existing
            }, { status: 409 });
        }
    }

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

    // 3. Handle Installment Plan Creation / Linking
    let installmentPlanId = body.installmentPlanId; // Could be passed if we selected an existing one in UI (future feature), but mostly null

    if (isInstallmentPlan && installments && installments.total > 1) {
        const currentQuota = installments.current || 1;

        // Calculate THE REAL Start Date of the plan (Month 1)
        const trueStartDate = new Date(date);
        trueStartDate.setMonth(trueStartDate.getMonth() - (currentQuota - 1));

        console.log(`[API] Installment Plan: Main Date=${date}, Quota=${currentQuota}/${installments.total}, Calculated StartDate=${trueStartDate.toISOString()}`);

        // Clean description for matching (remove numbers, "Cuota", etc to match the "Plan Parent")
        // e.g. "DLO*INPRO | Health Off 05/09" -> "DLO*INPRO | Health Off"
        // actually `description` passed here is potentially already cleaned by frontend, but let's be safe.
        // We want to find a plan that looks like this.

        // Try to find EXISTING plan
        // Match: Same User, Same Total Installments, Similarity in Description?
        // OR: Look for a plan that has a transaction with THIS description stem?
        // Simple heuristic: Same Total Count + Same Total Amount (approx) + Description contains...
        // Total Amount = Amount * Total
        const planTotalAmount = parseFloat(amount) * installments.total;

        // We search for plans created in the last year? or just loose.
        const existingPlans = await prisma.barbosaInstallmentPlan.findMany({
            where: {
                userId,
                installmentsCount: installments.total,
                // Fuzzy description match is hard in Prisma without Full Text Search.
                // We'll filter in memory or check fuzzy matches if needed. 
                // For now, let's try to match strict on Currency + StartDate approx?
                currency
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        let foundPlan = null;
        for (const p of existingPlans) {
            // Check Start Date proximity (within 5 days?)
            const planStart = new Date(p.startDate);
            const diffTime = Math.abs(trueStartDate.getTime() - planStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Check Amount proximity (allow small rounding diffs)
            const amtDiff = Math.abs(p.totalAmount - planTotalAmount);

            // Check Description similarity (simple includes)
            // If the Plan Description is "DLO*INPRO | Health Off" and current is similar
            const descMatch = description.toLowerCase().includes(p.description.toLowerCase()) || p.description.toLowerCase().includes(description.toLowerCase());

            if (diffDays < 35 && amtDiff < (parseFloat(amount) * 0.1) && descMatch) {
                // Found it! 35 days buffer allows for some month shifting/billing cycle weirdness
                foundPlan = p;
                console.log(`[API] Found existing Installment Plan: ${p.id} (${p.description})`);
                break;
            }
        }

        if (foundPlan) {
            installmentPlanId = foundPlan.id;

            // If we found the plan, we should check if there is an existing PROJECTED transaction for THIS quota
            // and delete it (or update it, but replacing is safer to ensure data freshness from PDF).
            const existingProjected = await prisma.barbosaTransaction.findFirst({
                where: {
                    installmentPlanId: foundPlan.id,
                    status: 'PROJECTED',
                    // Find the one that matches roughly the date we are inserting
                    date: {
                        gte: new Date(new Date(date).setDate(1)), // Start of this month
                        lte: new Date(new Date(date).setMonth(new Date(date).getMonth() + 1, 0)) // End of this month
                    }
                }
            });

            if (existingProjected) {
                console.log(`[API] Deleting existing PROJECTED transaction ${existingProjected.id} in favor of REAL import.`);
                await prisma.barbosaTransaction.delete({ where: { id: existingProjected.id } });
            }

        } else {
            // Create NEW Plan
            console.log(`[API] Creating NEW Installment Plan (Total: ${installments.total}). Start: ${trueStartDate.toISOString()}`);

            const plan = await prisma.barbosaInstallmentPlan.create({
                data: {
                    userId,
                    description: description || 'Compra en cuotas',
                    totalAmount: planTotalAmount,
                    currency,
                    installmentsCount: installments.total,
                    startDate: trueStartDate,
                    categoryId: validCategoryId,
                    subCategoryId: validSubCategoryId
                }
            });
            installmentPlanId = plan.id;

            // Generate ALL other installments (Past and Future) as PROJECTED
            // We skip the `currentQuota` index because that will be the REAL transaction created below.
            const promises = [];
            for (let i = 1; i <= installments.total; i++) {
                if (i === currentQuota) continue; // Skip the current one, it will be inserted as REAL

                const nextDate = new Date(trueStartDate);
                nextDate.setMonth(nextDate.getMonth() + (i - 1)); // i=1 -> Month 0 (Start Date)

                // Adjust day if needed (e.g. Feb 30 -> Feb 28)
                const originalDay = trueStartDate.getDate();
                if (nextDate.getDate() !== originalDay) {
                    nextDate.setDate(0);
                }

                // Determine if it's PAST or FUTURE relative to today? 
                // Actually it doesn't matter, usually we mark them as PROJECTED regardless, 
                // unless it's way in the past? 
                // User said: "ir cargando las 9 cuotas". Implies populate headers. 
                // We mark them PROJECTED. If they are in the past, they might clutter "Real" view if not filtered, 
                // but that's correct behavior (pending payments or history).
                // Actually, if it's in the past, maybe imported later?
                // Let's stick to PROJECTED status.

                promises.push(prisma.barbosaTransaction.create({
                    data: {
                        userId,
                        date: nextDate,
                        amount: parseFloat(amount),
                        currency,
                        type: 'EXPENSE',
                        description: `${description} (Cuota ${i}/${installments.total})`,
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
            description: description,
            categoryId: validCategoryId,
            subCategoryId: validSubCategoryId,
            status: body.status || 'REAL',
            isStatistical: body.isStatistical || false,
            installmentPlanId: installmentPlanId, // Use the resolved ID (new or existing)
            importSource: body.importSource,
            attachmentUrl: body.attachmentUrl,
            comprobante: body.comprobante
        },
        include: {
            category: true,
            subCategory: true
        }
    });

    console.log(`[API] Transaction created: ID=${tx.id}, Date=${tx.date.toISOString()}, Desc=${tx.description}`);

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
