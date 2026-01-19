import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// NOTE: Cannot use NextAuth in middleware due to 1MB Edge Function size limit
// Admin protection is handled at layout level instead (app/admin/layout.tsx)
export default function middleware(req: NextRequest) {
    const response = NextResponse.next();

    // Prevent caching for all routes to solve "back button" issue
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
}

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!_next/static|_next/image|print|.*\\.png$).*)'],
};
