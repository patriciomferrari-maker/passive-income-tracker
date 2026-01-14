import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth-helper';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session = await auth();
        // We need the REAL user ID, not the effective one
        const realUserId = session?.user?.id;

        if (!realUserId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: realUserId },
            include: {
                accessGiven: { include: { viewer: { select: { id: true, name: true, email: true } } } },
                accessReceived: { include: { owner: { select: { id: true, name: true, email: true } } } },
            }
        });

        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        return NextResponse.json({
            success: true,
            accessGiven: user.accessGiven.map(a => a.viewer),
            accessReceived: user.accessReceived.map(a => a.owner),
            currentDataOwnerId: user.dataOwnerId
        });

    } catch (error) {
        console.error("Error fetching access:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        const realUserId = session?.user?.id;

        if (!realUserId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { action, targetUserId } = body; // targetUserId is the OTHER person

        if (!targetUserId && action !== 'SWITCH_RESET') {
            return NextResponse.json({ success: false, error: 'Target User Missing' }, { status: 400 });
        }

        if (action === 'GRANT') {
            // I (Owner) grant access to Target (Viewer)
            // Check if already exists
            const existing = await prisma.sharedAccess.findFirst({
                where: { ownerId: realUserId, viewerId: targetUserId }
            });

            if (existing) return NextResponse.json({ success: true, message: 'Access already granted' });

            await prisma.sharedAccess.create({
                data: {
                    ownerId: realUserId,
                    viewerId: targetUserId
                }
            });
            return NextResponse.json({ success: true, message: 'Access Granted' });
        }

        if (action === 'REVOKE') {
            // I (Owner) revoke access from Target (Viewer)
            await prisma.sharedAccess.deleteMany({
                where: { ownerId: realUserId, viewerId: targetUserId }
            });
            return NextResponse.json({ success: true, message: 'Access Revoked' });
        }

        // SWITCH CONTEXT
        if (action === 'SWITCH') {
            // I (Viewer) want to see Target (Owner)

            // 1. Verify I have permission
            const permission = await prisma.sharedAccess.findFirst({
                where: { ownerId: targetUserId, viewerId: realUserId }
            });

            if (!permission && targetUserId !== realUserId) {
                return NextResponse.json({ success: false, error: 'No permission to view this account' }, { status: 403 });
            }

            // 2. Set my dataOwnerId
            await prisma.user.update({
                where: { id: realUserId },
                data: { dataOwnerId: targetUserId === realUserId ? null : targetUserId }
            });

            return NextResponse.json({ success: true, message: `Switched to ${targetUserId}` });
        }

        if (action === 'SWITCH_RESET') {
            await prisma.user.update({
                where: { id: realUserId },
                data: { dataOwnerId: null }
            });
            return NextResponse.json({ success: true, message: 'Switched directly to self' });
        }

        return NextResponse.json({ success: false, error: 'Invalid Action' }, { status: 400 });

    } catch (error) {
        console.error("Error modifying access:", error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
