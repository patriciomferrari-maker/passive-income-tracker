import { NextResponse } from 'next/server';
import { checkAllUtilities } from '@/app/lib/utility-checker';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for all users

export async function GET(request: Request) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.error('[Utilities Cron] Unauthorized: Invalid or missing CRON_SECRET');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Utilities Cron] Starting automated utilities check...');

        // Get all users
        const users = await prisma.user.findMany({
            select: { id: true, email: true }
        });

        console.log(`[Utilities Cron] Found ${users.length} users`);

        const results = [];

        for (const user of users) {
            try {
                console.log(`\n[Utilities Cron] Checking utilities for user: ${user.email}`);
                const summary = await checkAllUtilities(user.id);

                results.push({
                    userId: user.id,
                    email: user.email,
                    success: true,
                    summary
                });

                console.log(`[Utilities Cron] ✅ Completed for ${user.email}: ${summary.upToDate} up to date, ${summary.overdue} overdue, ${summary.errors} errors`);
            } catch (error: any) {
                console.error(`[Utilities Cron] ❌ Error for user ${user.email}:`, error);
                results.push({
                    userId: user.id,
                    email: user.email,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        console.log(`\n[Utilities Cron] 📊 Final Summary: ${successCount} successful, ${failureCount} failed`);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            usersProcessed: users.length,
            successCount,
            failureCount,
            results
        });

    } catch (error: any) {
        console.error('[Utilities Cron] Fatal error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
