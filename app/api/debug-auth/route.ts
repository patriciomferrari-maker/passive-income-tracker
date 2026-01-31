
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check Env Vars availability
        const envCheck = {
            NODE_ENV: process.env.NODE_ENV,
            AUTH_SECRET: process.env.AUTH_SECRET ? 'Set (Length: ' + process.env.AUTH_SECRET.length + ')' : 'MISSING',
            POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? 'Set' : 'MISSING',
            VERCEL_URL: process.env.VERCEL_URL,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL
        };

        // 2. Check DB Connection
        const userCount = await prisma.user.count();
        const dbStatus = {
            connected: true,
            userCount
        };

        return NextResponse.json({
            status: 'ok',
            env: envCheck,
            db: dbStatus,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
