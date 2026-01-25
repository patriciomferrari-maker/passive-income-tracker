
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';
import { toArgNoon } from '@/app/lib/date-utils';

function cleanDescription(desc: string | null | undefined): string {
    if (!desc) return '';
    return desc
        .replace(/\s*\(?Cuota\s*\d+\/\d+\)?/i, '')
        .replace(/\s*\d+\/\d+$/, '')
        .trim();
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const whereClause: any = { userId };

    if (month && year) {
        // Use noon anchored dates for query range too, to cover "The Whole Day" effectively
        // Actually for range query, we want Start of Day to End of Day.
        // But if DB dates are 15:00 UTC, we must ensure range covers it.
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
    console.log('[API] POST /api/barbosa/transactions - Received:', JSON.stringify(body, null, 2));
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
    // We check for duplicates based on Voucher (High confidence) OR (Date + Amount + Desc)
    const isVoucherValid = comprobante && String(comprobante).length > 2 && !String(comprobante).includes('$');

    let existing = null;
    const cleanBodyDesc = cleanDescription(description).toLowerCase();

    if (isVoucherValid) {
        // PRIORITY: Composite key (description + comprobante) if available
        const sameVoucher = await prisma.barbosaTransaction.findMany({
            where: {
                userId,
                comprobante: String(comprobante)
            }
        });
        existing = sameVoucher.find(ext =>
            cleanDescription(ext.description).toLowerCase() === cleanBodyDesc
        );
        if (existing) console.log('[API] Duplicate detected by VOUCHER + DESC:', comprobante, cleanBodyDesc);
    }

    if (!existing && date && amount) {
        // FALLBACK: If no voucher, or no match, use composite key (Date + Amount + Description)
        const possibleDuplicates = await prisma.barbosaTransaction.findMany({
            where: {
                userId,
                date: new Date(date),
                amount: parseFloat(amount),
            }
        });

        existing = possibleDuplicates.find(ext =>
            cleanDescription(ext.description).toLowerCase() === cleanBodyDesc
        );

        if (existing) console.log('[API] Duplicate detected by DATE / AMOUNT / DESC (Cleaned):', description);
    }

    if (existing) {
        return NextResponse.json({
            error: 'DUPLICATE',
            message: 'La transacción "' + description + '" ya existe(ID: ' + existing.id + ').',
            transaction: existing
        }, { status: 409 });
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

        console.log(`[API DEBUG] Installment Import:`, {
            description,
            isInstallmentPlan,
            installments,
            originalDate: date,
            currentQuota
        });

        // Calculate THE REAL Start Date of the plan (Month 1)
        // LOGIC: If this is Quota 6/12, then the plan started 5 months ago.
        const trueStartDate = toArgNoon(date instanceof Date ? date : new Date(date), 'keep-day');
        if (currentQuota > 1) {
            trueStartDate.setMonth(trueStartDate.getMonth() - (currentQuota - 1));
        }

        console.log('[API DEBUG] Calculated Plan Start:', trueStartDate.toISOString());

        // Try to find EXISTING plan
        const planTotalAmount = parseFloat(amount) * installments.total;

        const existingPlans = await prisma.barbosaInstallmentPlan.findMany({
            where: {
                userId,
                installmentsCount: installments.total,
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

            // Check Amount proximity (allow 10% tolerance)
            const amtDiff = Math.abs(p.totalAmount - planTotalAmount);

            // Check Description similarity
            const descMatch = description.toLowerCase().includes(p.description.toLowerCase()) || p.description.toLowerCase().includes(description.toLowerCase());

            if (diffDays < 35 && amtDiff < (parseFloat(amount) * 0.1) && descMatch) {
                foundPlan = p;
                console.log('[API] Found existing Installment Plan: ' + p.id + ' (' + p.description + ')');
                break;
            }
        }

        if (foundPlan) {
            installmentPlanId = foundPlan.id;

            // Delete conflicting PROJECTED transaction if exists
            const existingProjected = await prisma.barbosaTransaction.findFirst({
                where: {
                    installmentPlanId: foundPlan.id,
                    status: 'PROJECTED',
                    date: {
                        gte: new Date(new Date(date).setDate(1)),
                        lte: new Date(new Date(date).setMonth(new Date(date).getMonth() + 1, 0))
                    }
                }
            });

            if (existingProjected) {
                console.log('[API] Deleting existing PROJECTED transaction ' + existingProjected.id + ' in favor of REAL import.');
                await prisma.barbosaTransaction.delete({ where: { id: existingProjected.id } });
            }

            // Promote past projected to REAL
            await prisma.barbosaTransaction.updateMany({
                where: {
                    installmentPlanId: foundPlan.id,
                    status: 'PROJECTED',
                    date: { lt: toArgNoon(date, 'keep-day') }
                },
                data: { status: 'REAL' }
            });

        } else {
            // Create NEW Plan
            console.log('[API] Creating NEW Installment Plan (Total: ' + installments.total + '). Start: ' + trueStartDate.toISOString());

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

            // Generate ONLY FUTURE installments
            // Start from currentQuota + 1. No backfill.
            const promises = [];
            for (let i = currentQuota + 1; i <= installments.total; i++) {

                const nextDate = new Date(trueStartDate);
                // Shift months relative to origin
                nextDate.setMonth(nextDate.getMonth() + (i - currentQuota));

                // Adjust day envelope
                const originalDay = trueStartDate.getDate();
                if (nextDate.getDate() !== originalDay) {
                    nextDate.setDate(0);
                }

                promises.push(prisma.barbosaTransaction.create({
                    data: {
                        userId,
                        date: nextDate,
                        amount: parseFloat(amount),
                        currency,
                        type: 'EXPENSE',
                        description: description + ' (Cuota ' + i + '/' + installments.total + ')',
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
            date: toArgNoon(date, 'keep-day'), // Standardize Input Date
            amount: parseFloat(amount),
            currency,
            type: type || category?.type || 'EXPENSE',
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

    console.log('[API] Transaction created: ID=' + tx.id + ', Date=' + tx.date.toISOString() + ', Desc=' + tx.description);

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
                    description: description || 'Sync desde Barbosa (' + category.name + ')',
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
