
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Helper to prevent unauthorized access (Simple check for now, ideally middleware)
// For now, only allow if user exists (we assume Admin Page is protected by page layout or middleware)

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dataOwnerId: true,
                createdAt: true,
                _count: {
                    select: {
                        dataViewers: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, email, password, name, dataOwnerId } = body;

        if (action === 'CREATE_MIRROR') {
            if (!email || !password || !dataOwnerId) {
                return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
            }

            // Check if source exists
            const sourceInfo = await prisma.user.findUnique({ where: { id: dataOwnerId } });
            if (!sourceInfo) return NextResponse.json({ success: false, error: 'Source user not found' }, { status: 404 });

            // Check if email taken
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 409 });

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: name || email.split('@')[0],
                    role: 'USER',
                    dataOwnerId: sourceInfo.id
                }
            });

            return NextResponse.json({ success: true, user: newUser });
        }

        if (action === 'LINK_MIRROR') {
            const { targetUserId, sourceUserId } = body;

            if (!targetUserId) return NextResponse.json({ success: false, error: 'Target User missing' }, { status: 400 });

            // If sourceUserId is null/empty, we are UNLINKING
            if (!sourceUserId) {
                await prisma.user.update({
                    where: { id: targetUserId },
                    data: { dataOwnerId: null }
                });
                return NextResponse.json({ success: true, message: 'Unlinked' });
            }

            // Verify source exists
            const source = await prisma.user.findUnique({ where: { id: sourceUserId } });
            if (!source) return NextResponse.json({ success: false, error: 'Source user not found' }, { status: 404 });

            // Prevent self-mirroring or circular (simple check: id != id)
            if (targetUserId === sourceUserId) return NextResponse.json({ success: false, error: 'Cannot mirror self' }, { status: 400 });

            await prisma.user.update({
                where: { id: targetUserId },
                data: { dataOwnerId: sourceUserId }
            });

            return NextResponse.json({ success: true, message: 'Linked' });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
