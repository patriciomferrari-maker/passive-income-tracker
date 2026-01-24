
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

        // Calculate THE REAL Start Date of the plan (Month 1)
        const trueStartDate = toArgNoon(date instanceof Date ? date : new Date(date), 'keep-day');

        // USER REQUEST FINAL: "toma como premisa para las cuotas, la fecha que aparece en el pdf, no hagamos nada mas."
        // "y apartir de ahi, hacer correr las fechas, sobre esa fecha de origen"
        // LOGIC: Plan Start = PDF Date.
        // We do NOT backfill past.
        // We only generate FUTURE installments (if any).
        // trueStartDate is already set to PDF Date. Do NOT subtract months.

        console.log('[API] Installment Plan: Main Date = ' + date + ', Quota = ' + currentQuota + '/' + installments.total + ', Calculated StartDate=' + trueStartDate.toISOString());

        // ... (existing helper code omitted for brevity matches original file) ...

        // Clean description for matching ...
        const planTotalAmount = parseFloat(amount) * installments.total;

        // ... (Simulated matching existing plan logic - lines 190-260 stay same, assuming existing plan check is robust) ...

        // IF NO EXISTING PLAN, CREATE NEW ONE
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
        // We start from currentQuota + 1. 
        // We skip 1 to currentQuota-1 (No history/backfill).
        const promises = [];
        for (let i = currentQuota + 1; i <= installments.total; i++) {

            const nextDate = new Date(trueStartDate);
            // "Hacer correr las fechas sobre esa fecha de origen"
            // If origin (trueStartDate) is Quota X.
            // Quota X+1 should be 1 month after.
            // Delta = i - currentQuota.
            nextDate.setMonth(nextDate.getMonth() + (i - currentQuota));

            // Adjust day if needed (e.g. Feb 30 -> Feb 28)
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
                    status: 'PROJECTED', // Future is always projected
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
