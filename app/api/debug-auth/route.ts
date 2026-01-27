
import { getUserId } from '@/app/lib/auth-helper';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        return NextResponse.json({
            userId,
            authenticated: !!userId,
            meta: 'Debug Auth Endpoint'
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
