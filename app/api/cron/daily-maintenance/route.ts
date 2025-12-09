
import { NextResponse } from 'next/server';
import { runDailyMaintenance } from '@/app/lib/cron-service';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const force = url.searchParams.get('force') === 'true'; // Allow manual testing
        const userId = url.searchParams.get('userId');

        // Verify CRON_SECRET for security if not running locally/manually? 
        // Actually this endpoint is protected by Vercel Cron headers usually, 
        // but explicit CRON_SECRET check is good practice if exposing it.
        // For now, let's keep it simple as it was before or just basic secret check.
        // The previous implementation didn't check CRON_SECRET inside the function body explicitly 
        // (it relied on Vercel or `test-email` passing it, but `fetch` was adding it).
        // Let's add a basic check.

        const authHeader = req.headers.get('authorization');
        if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const result = await runDailyMaintenance(force, userId || undefined);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Cron Job Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
