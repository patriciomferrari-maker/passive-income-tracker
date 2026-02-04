import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

// GET: Fetch unread (or recent) notifications
export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20 // Limit to recent 20
        });

        const unreadCount = await prisma.notification.count({
            where: { userId, isRead: false }
        });

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create a notification (Internal or Manual Trigger)
export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // Optional: Admin check here if we want to prevent users from spamming themselves
        // For now, allowing self-creation for testing ease.

        const body = await req.json();
        const { title, message, type, link } = body;

        if (!title || !message) {
            return NextResponse.json({ error: 'Missing title or message' }, { status: 400 });
        }

        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type: type || 'INFO',
                link
            }
        });

        return NextResponse.json(notification);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
