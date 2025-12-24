import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        console.log('[Debug Auth] Starting user query test...');

        // Try to fetch a user
        const user = await prisma.user.findFirst({
            select: { id: true, email: true, name: true, role: true },
            take: 1
        });

        if (user) {
            return NextResponse.json({
                success: true,
                message: 'User query successful',
                user: {
                    id: user.id,
                    email: user.email
                }
            });
        } else {
            return NextResponse.json({
                success: true,
                message: 'No users found in database'
            });
        }
    } catch (error) {
        console.error('[Debug Auth] Error:', error);
        return NextResponse.json({
            error: 'Query failed',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
