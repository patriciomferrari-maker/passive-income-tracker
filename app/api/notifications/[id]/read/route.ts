import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// PATCH: Mark as read
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> } // Params is a Promise in Next.js 15+
) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { id } = await params;

        // Verify ownership
        const notification = await prisma.notification.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!notification) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        if (notification.userId !== userId) {
            return unauthorized();
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        return NextResponse.json(updated);

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
