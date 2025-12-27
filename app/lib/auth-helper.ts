import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Get user ID from session
 * Works without middleware by reading session from cookies
 */
export async function getUserId() {
    try {
        // Get session via auth() which reads from cookies
        const session = await auth();

        if (session?.user?.id) {
            console.log('[AUTH] Session found for user:', session.user.email);
            return session.user.id;
        }

        // If no session, return null matching expected behavior in API routes
        console.warn('[AUTH] No session found - user not logged in');
        return null;
    } catch (error) {
        console.error('[AUTH] Error in getUserId:', error);
        return null;
    }
}

export function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
