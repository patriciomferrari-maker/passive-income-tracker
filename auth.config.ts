
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;

            // 0. Public Routes explicitly allowed
            if (nextUrl.pathname.startsWith('/print')) return true;

            // 1. API Protection
            if (nextUrl.pathname.startsWith('/api')) {
                // Allow NextAuth routes
                if (nextUrl.pathname.startsWith('/api/auth')) return true;
                if (nextUrl.pathname === '/api/health') return true;
                // Basic API protection: Block if not logged in
                return isLoggedIn;
            }

            // 2. Auth Pages (Login/Register)
            if (nextUrl.pathname === '/login' || nextUrl.pathname === '/register') {
                if (isLoggedIn) {
                    return Response.redirect(new URL('/', nextUrl));
                }
                return true;
            }

            // 3. Protected Pages (Everything else)
            // If logged in, allow access. If not, false triggers redirect to /login
            return isLoggedIn;
        },
    },
    providers: [], // Add providers with an empty array for now
    trustHost: true,
    session: {
        strategy: 'jwt',
        maxAge: 900, // 15 Minutes
        updateAge: 300, // Update session every 5 minutes if active
    }
} satisfies NextAuthConfig;
