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
        exchangeRate
    } = body;

    // Validate Category Exists (and belongs to user)
    const category = await prisma.barbosaCategory.findFirst({
        where: { id: categoryId, userId }
    });

    if (!category) {
        return NextResponse.json({ error: 'Invalid Category' }, { status: 400 });
    }

    // Validate SubCategory (if provided)
    let validSubCategoryId = null;
    if (subCategoryId) {
        const subCategory = await prisma.barbosaSubCategory.findFirst({
            where: { id: subCategoryId, categoryId: category.id }
        });
        if (subCategory) {
            validSubCategoryId = subCategory.id;
        }
    }

    // Create Transaction
    const tx = await prisma.barbosaTransaction.create({
        data: {
            userId,
            date: new Date(date),
            amount: parseFloat(amount),
            currency,
            type,
            exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
            amountUSD: currency === 'USD' ? parseFloat(amount) : (exchangeRate ? parseFloat(amount) / parseFloat(exchangeRate) : null),
            description,
            categoryId: category.id,
            subCategoryId: validSubCategoryId
        },
        include: {
            category: true,
            subCategory: true
        }
    });

    // --- COSTA SYNC LOGIC ---
    // If the category is "Costa Esmeralda", also create a transaction in the Costa module.
    // Logic: Barbosa SubCategory -> Costa Category.
    if (category.name.toLowerCase().includes('costa')) {
        try {
            console.log('Syncing to Costa module...');

            // 1. Determine Target Category Name in Costa
            // If subcategory exists, use its name. Otherwise fallback to "Varios" or the generic Category name.
            let targetCategoryName = 'Varios';
            if (validSubCategoryId) {
                // We need to fetch the subcategory name if we checked validSubCategoryId but didn't keep the object reference
                const subCatObj = await prisma.barbosaSubCategory.findUnique({ where: { id: validSubCategoryId } });
                if (subCatObj) targetCategoryName = subCatObj.name;
            } else {
                targetCategoryName = 'General'; // Fallback if no subcategory
            }

            // 2. Find or Create Costa Category
            let costaCategory = await prisma.costaCategory.findFirst({
                where: { userId, name: targetCategoryName, type: 'EXPENSE' }
            });

            if (!costaCategory) {
                console.log(`Creating new Costa Category: ${targetCategoryName}`);
                costaCategory = await prisma.costaCategory.create({
                    data: {
                        userId,
                        name: targetCategoryName,
                        type: 'EXPENSE'
                    }
                });
            }

            // 3. Create Costa Transaction
            await prisma.costaTransaction.create({
                data: {
                    userId,
                    date: new Date(date),
                    type: 'EXPENSE', // Always expense for now when syncing from generic Barbosa expense
                    amount: parseFloat(amount),
                    currency,
                    description: description || `Sync desde Barbosa (${category.name})`,
                    categoryId: costaCategory.id
                }
            });

            console.log('Costa Sync successful.');

        } catch (error) {
            console.error('Error syncing to Costa:', error);
            // Non-blocking error. We don't fail the main request if sync fails.
        }
    }
    // ------------------------

    return NextResponse.json(tx);
}
