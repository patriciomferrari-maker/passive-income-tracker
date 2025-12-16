import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { categoryId, name } = body;

    // Verify category ownership
    const category = await prisma.barbosaCategory.findFirst({ where: { id: categoryId, userId } });
    if (!category) return NextResponse.json({ error: 'Invalid Category' }, { status: 400 });

    const sub = await prisma.barbosaSubCategory.create({
        data: { categoryId, name }
    });
    return NextResponse.json(sub);
}

export async function DELETE(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Verify ownership via category
    const sub = await prisma.barbosaSubCategory.findUnique({
        where: { id },
        include: { category: true }
    });

    if (!sub || sub.category.userId !== userId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.barbosaSubCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
