
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;

            // 1. API: Always allowed (Auth handled by Route Handlers)
            if (nextUrl.pathname.startsWith('/api')) {
                return true;
            }

            // 2. Auth Pages (Login/Register)
            if (nextUrl.pathname === '/login' || nextUrl.pathname === '/register') {
                if (isLoggedIn) {
                    return Response.redirect(new URL('/', nextUrl));
                }
                return true; // Allow access to login/register if not logged in
            }

            // 3. Protected Pages (Dashboard, etc.)
            // Logic: If we are here, it's not API and not Auth Page.
            // So it MUST be a protected page? Or public?
            // Assuming everything else is protected for now based on original logic.
            if (isLoggedIn) return true;

            return false; // Redirect unauthenticated users to login page
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
