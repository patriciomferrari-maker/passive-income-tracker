import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        // Clear all Next-Auth cookies
        const cookieStore = await cookies();

        // Delete session token cookies (both secure and non-secure versions)
        cookieStore.delete('next-auth.session-token');
        cookieStore.delete('__Secure-next-auth.session-token');
        cookieStore.delete('next-auth.callback-url');
        cookieStore.delete('__Secure-next-auth.callback-url');
        cookieStore.delete('next-auth.csrf-token');
        cookieStore.delete('__Secure-next-auth.csrf-token');

        return NextResponse.json({
            success: true,
            message: 'All session cookies cleared. Please refresh and try logging in again.'
        });
    } catch (error) {
        console.error('[Clear Session] Error:', error);
        return NextResponse.json({
            error: 'Failed to clear session',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
