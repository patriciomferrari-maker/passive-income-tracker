
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;

        // Verify ownership
        const plan = await prisma.barbosaInstallmentPlan.findFirst({
            where: { id, userId }
        });

        if (!plan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        // Delete Plan (Cascade will delete transactions)
        await prisma.barbosaInstallmentPlan.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete Installment Plan Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
