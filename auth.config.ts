
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') ||
                nextUrl.pathname.startsWith('/investments') ||
                nextUrl.pathname.startsWith('/alquileres') ||
                nextUrl.pathname.startsWith('/hogar') ||
                nextUrl.pathname.startsWith('/settings');

            // 1. API Protection
            if (nextUrl.pathname.startsWith('/api')) {
                // Allow NextAuth routes and potentially public webhooks
                if (nextUrl.pathname.startsWith('/api/auth')) return true;

                // Allow specific public API if needed (e.g. Health check)
                if (nextUrl.pathname === '/api/health') return true;

                // Block everything else if not logged in
                if (!isLoggedIn) return false;

                return true;
            }

            // 2. Auth Pages (Login/Register)
            if (nextUrl.pathname === '/login' || nextUrl.pathname === '/register') {
                if (isLoggedIn) {
                    return Response.redirect(new URL('/', nextUrl));
                }
                return true;
            }

            // 3. Public Pages (Home)
            if (nextUrl.pathname === '/') {
                return true;
            }

            // 4. Default Block for other protected pages
            if (isLoggedIn) return true;

            return false;
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
