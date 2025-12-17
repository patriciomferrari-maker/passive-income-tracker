
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        const isLoggedIn = !!auth?.user;
        const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') ||
            nextUrl.pathname.startsWith('/investments') ||
            nextUrl.pathname.startsWith('/alquileres') ||
            nextUrl.pathname.startsWith('/barbosa') ||
            nextUrl.pathname.startsWith('/settings');

        // 1. API Protection
        if(nextUrl.pathname.startsWith('/api')) {
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
    // Home is now a landing page, so it's public.
    // However, if we want to auto-redirect logged in users to dashboard, we can do it here.
    // For now, let's keep it accessible to everyone.
    return true;
}

// 4. Default Block for other protected pages
// If it's not one of the above, and user is enabled, allow? 
// Better to block by default if we are unsure.
// But we have many routes. Let's rely on the previous logic: "If specific protected routes -> check login".

// Actually, let's simplify:
// If user is NOT logged in, and trying to access something that is NOT public -> Block.
// Public: /, /login, /register, /api/auth.

if (isLoggedIn) return true;

return false; // Redirect unauthenticated users to login page
    },
providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
