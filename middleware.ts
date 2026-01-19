import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

export default async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;

    // Protect /admin routes
    if (pathname.startsWith('/admin')) {
        const session = await auth();

        // Not logged in → redirect to login
        if (!session?.user) {
            const loginUrl = new URL('/login', req.url);
            loginUrl.searchParams.set('callbackUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Logged in but not admin → redirect to dashboard
        if (session.user.role !== 'ADMIN') {
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }
    }

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
