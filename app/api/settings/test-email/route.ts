import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { runDailyMaintenance } from '@/app/lib/cron-service';

export async function POST() {
    try {
        let userId: string;
        try {
            userId = await getUserId();
        } catch (e: any) {
            console.error('Test Email Auth Check Failed:', e);
            return NextResponse.json({
                error: 'Unauthorized',
                debug: 'Session check failed',
                details: e.message
            }, { status: 401 });
        }

        // DIRECT CALL - Bypassing Vercel HTTP Authentication Wall
        // Instead of fetching the URL, we run the function directly on the server.
        const result = await runDailyMaintenance(true, userId);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Test Email Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
    }
}
