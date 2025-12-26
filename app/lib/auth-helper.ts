import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Get user ID from session
 * Falls back to checking headers for cookie-based session
 */
export async function getUserId() {
    try {
        // Try getting session via auth()
        const session = await auth();

        if (session?.user?.id) {
            return session.user.id;
        }

        // If no session, throw unauthorized
        console.error('[AUTH] No session found');
        throw new Error("Unauthorized");
    } catch (error) {
        console.error('[AUTH] Error in getUserId:', error);
        throw new Error("Unauthorized");
    }
}

export function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
