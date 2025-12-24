import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({
                error: 'No session',
                session: session
            }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            userId: session.user.id,
            email: session.user.email
        });
    } catch (error) {
        console.error('[Health Check] Error:', error);
        return NextResponse.json({
            error: 'Internal error',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
