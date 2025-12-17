import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();

        return NextResponse.json({
            isAuthenticated: !!session,
            user: session?.user || null,
            userId: session?.user?.id || 'undefined',
            timestamp: new Date().toISOString(),
            node_env: process.env.NODE_ENV
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Failed to check auth',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
