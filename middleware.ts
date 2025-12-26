import { auth } from "@/auth"
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;

    // Allow public paths
    const isPublicPath =
        nextUrl.pathname === '/' ||
        nextUrl.pathname.startsWith('/login') ||
        nextUrl.pathname.startsWith('/register') ||
        nextUrl.pathname.startsWith('/api/auth') ||
        nextUrl.pathname === '/api/health';

    if (isPublicPath) {
        return NextResponse.next();
    }

    // Redirect to login if not authenticated
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL('/login', nextUrl));
    }

    // User is authenticated, allow request
    const response = NextResponse.next();

    // Prevent caching for all routes to solve "back button" issue
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
});

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ['/((?!_next/static|_next/image|print|.*\\.png$).*)'],
};
