
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rules = await prisma.barbosaRecurrence.findMany({
        where: { userId },
        include: {
            category: true,
            subCategory: true
        },
        orderBy: { dayOfMonth: 'asc' }
    });

    return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, dayOfMonth, amount, currency, categoryId, subCategoryId, type, isStatistical } = body;

    const rule = await prisma.barbosaRecurrence.create({
        data: {
            userId,
            name,
            dayOfMonth: parseInt(dayOfMonth),
            amount: parseFloat(amount),
            currency,
            categoryId,
            subCategoryId: subCategoryId || null,
            type,
            active: true,
            isStatistical: isStatistical || false
        }
    });

    return NextResponse.json(rule);
}
