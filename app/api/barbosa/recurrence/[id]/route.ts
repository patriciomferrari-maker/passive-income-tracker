
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, dayOfMonth, amount, currency, categoryId, subCategoryId, type, active, isStatistical } = body;

    const exists = await prisma.barbosaRecurrence.findFirst({ where: { id, userId } });
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.barbosaRecurrence.update({
        where: { id },
        data: {
            name,
            dayOfMonth: parseInt(dayOfMonth),
            amount: parseFloat(amount),
            currency,
            categoryId,
            subCategoryId: subCategoryId || null,
            type,
            active,
            isStatistical
        }
    });

    return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    await prisma.barbosaRecurrence.deleteMany({
        where: { id, userId } // deleteMany for safety if id matches user
    });

    return NextResponse.json({ success: true });
}
