import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rules = await prisma.barbosaCategorizationRule.findMany({
        where: { userId },
        include: { category: true }
    });

    return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pattern, categoryId, subCategoryId } = body;

    if (!pattern || !categoryId) {
        return NextResponse.json({ error: 'Pattern and Category are required' }, { status: 400 });
    }

    const rule = await prisma.barbosaCategorizationRule.upsert({
        where: {
            userId_pattern: {
                userId,
                pattern: pattern.toLowerCase()
            }
        },
        update: {
            categoryId,
            subCategoryId
        },
        create: {
            userId,
            pattern: pattern.toLowerCase(),
            categoryId,
            subCategoryId
        }
    });

    return NextResponse.json(rule);
}
