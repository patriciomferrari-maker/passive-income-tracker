
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
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
        isStatistical
    } = body;

    // Verify ownership
    const existingTx = await prisma.barbosaTransaction.findFirst({
        where: { id, userId }
    });

    if (!existingTx) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Validate Category Exists
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

    // Update
    const updatedTx = await prisma.barbosaTransaction.update({
        where: { id },
        data: {
            date: new Date(date),
            amount: parseFloat(amount),
            currency,
            type,
            exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
            amountUSD: currency === 'USD' ? parseFloat(amount) : (exchangeRate ? parseFloat(amount) / parseFloat(exchangeRate) : null),
            description,
            categoryId: category.id,
            subCategoryId: validSubCategoryId,
            status: status || 'REAL',
            isStatistical: isStatistical || false
        },
        include: {
            category: true,
            subCategory: true
        }
    });

    // --- SYNC UPDATE LOGIC ---
    if (existingTx.linkedTransactionId) {
        try {
            await prisma.costaTransaction.update({
                where: { id: existingTx.linkedTransactionId },
                data: {
                    date: new Date(date),
                    amount: parseFloat(amount),
                    currency,
                    description: description || `Sync desde Barbosa`
                }
            });
            console.log('Synced Delete/Update to Costa');
        } catch (e) {
            console.error('Failed to sync update:', e);
        }
    }
    // -------------------------

    return NextResponse.json(updatedTx);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Verify ownership
    const existingTx = await prisma.barbosaTransaction.findFirst({
        where: { id, userId }
    });

    if (!existingTx) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // --- SYNC DELETE LOGIC ---
    if (existingTx.linkedTransactionId) {
        try {
            await prisma.costaTransaction.delete({
                where: { id: existingTx.linkedTransactionId }
            });
            console.log('Synced Delete to Costa');
        } catch (e) {
            console.error('Failed to sync delete:', e);
        }
    }
    // -------------------------

    await prisma.barbosaTransaction.delete({
        where: { id }
    });

    return NextResponse.json({ success: true });
}
