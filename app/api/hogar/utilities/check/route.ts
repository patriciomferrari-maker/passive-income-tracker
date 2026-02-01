import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { checkAllUtilities } from '@/app/lib/utility-checker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for scraping

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        console.log(`[Utilities Check API] Starting manual check for user ${userId}`);

        const summary = await checkAllUtilities(userId);

        return NextResponse.json({
            success: true,
            message: 'Utilities check completed',
            summary
        });

    } catch (error: any) {
        console.error('[Utilities Check API] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
