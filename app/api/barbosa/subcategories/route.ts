import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { categoryId, name } = body;

    if (!categoryId || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Validate parent ownership
    const parent = await prisma.barbosaCategory.findFirst({ where: { id: categoryId, userId } });
    if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 404 });

    // Check duplicates
    const existing = await prisma.barbosaSubCategory.findFirst({
        where: {
            categoryId,
            name: { equals: name, mode: 'insensitive' }
        }
    });

    if (existing) {
        return NextResponse.json({ error: 'Ya existe una subcategoría con ese nombre' }, { status: 400 });
    }

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

    // Check ownership through parent category is implicit if we trust ID, 
    // but better to join or findFirst. Assuming we can just delete if it exists and dependencies are clear.
    // However, SubCategories also have dependencies (Transactions, Recurrences).
    // Let's check dependencies first.

    const transactionCount = await prisma.barbosaTransaction.count({ where: { subCategoryId: id } });
    const recurrenceCount = await prisma.barbosaRecurrence.count({ where: { subCategoryId: id } });

    // Check if any installment plan uses it? Schema: subCategoryId is on Plan? Yes.
    // But currently InstallmentPlan has subCategoryId? Let's check schema.
    // Yes: subCategoryId String?
    const installmentCount = await prisma.barbosaInstallmentPlan.count({ where: { subCategoryId: id } });

    if (transactionCount > 0 || recurrenceCount > 0 || installmentCount > 0) {
        return NextResponse.json({
            error: `No se puede eliminar: Tiene ${transactionCount} transacciones, ${recurrenceCount} recurrencias y ${installmentCount} planes asociados.`
        }, { status: 400 });
    }

    await prisma.barbosaSubCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
