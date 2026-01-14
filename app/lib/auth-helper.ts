import { prisma } from "@/lib/prisma"; // Adjust path if needed
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
            // Check for Mirror/Shared Account
            const realId = session.user.id;
            try {
                // Determine if this user is a "Mirror" of another
                const user = await prisma.user.findUnique({
                    where: { id: realId },
                    select: { dataOwnerId: true }
                });

                if (user?.dataOwnerId) {
                    console.log(`[AUTH] Mirror Access: ${realId} viewing data of ${user.dataOwnerId}`);
                    return user.dataOwnerId;
                }
            } catch (dbError) {
                console.warn('[AUTH] Failed to check dataOwnerId, using session ID', dbError);
            }

            console.log('[AUTH] Session found for user:', session.user.email);
            return realId;
        }

        // DEVELOPMENT BYPASS: Return a default user ID if in development or if AUTH_SECRET is missing locally
        // We check for localhost or development environment
        const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

        if (isDev) {
            console.log('[AUTH] Local/Dev context: using fallback user ID');
            return 'cmixq96ww0000l8pp4w1zu2cy'; // Patricio's user ID
        }

        // If no session, return null matching expected behavior in API routes
        console.warn('[AUTH] No session found - user not logged in');
        return null;
    } catch (error) {
        // If auth() fails (e.g. MissingSecret), we still want to bypass in local dev
        const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
        if (isDev) {
            console.log('[AUTH] Local/Dev error (likely MissingSecret): using fallback user ID');
            return 'cmixq96ww0000l8pp4w1zu2cy'; // Patricio's user ID
        }
        console.error('[AUTH] Error in getUserId:', error);
        return null;
    }
}

export function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
