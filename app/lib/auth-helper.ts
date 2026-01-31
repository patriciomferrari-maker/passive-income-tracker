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
                    // console.log(`[AUTH] Mirror Access: ${realId} viewing data of ${user.dataOwnerId}`);
                    return user.dataOwnerId;
                }
            } catch (dbError) {
                console.warn('[AUTH] Failed to check dataOwnerId, using session ID', dbError);
            }

            // console.log('[AUTH] Session found for user:', session.user.email);
            return realId;
        }

        // Check for specific API Key / Token in headers if needed (for external scripts)
        // const authHeader = headers().get('authorization');
        // if (authHeader === `Bearer ${process.env.CRON_SECRET}`) ...

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
