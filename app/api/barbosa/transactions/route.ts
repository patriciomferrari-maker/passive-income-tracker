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
        categoryName,
        subCategoryName,
        type,
        description,
        exchangeRate
    } = body;

    // 1. Find or Create Category
    let category = await prisma.barbosaCategory.findFirst({
        where: { userId, name: categoryName, type }
    });

    if (!category) {
        category = await prisma.barbosaCategory.create({
            data: { userId, name: categoryName, type }
        });
    }

    // 2. Find or Create SubCategory
    let subCategory = null;
    if (subCategoryName) {
        subCategory = await prisma.barbosaSubCategory.findFirst({
            where: { categoryId: category.id, name: subCategoryName }
        });

        if (!subCategory) {
            subCategory = await prisma.barbosaSubCategory.create({
                data: { categoryId: category.id, name: subCategoryName }
            });
        }
    }

    // 3. Create Transaction
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
            subCategoryId: subCategory?.id
        },
        include: {
            category: true,
            subCategory: true
        }
    });

    return NextResponse.json(tx);
}
