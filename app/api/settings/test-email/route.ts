import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function POST() {
    try {
        let userId: string;
        try {
            userId = await getUserId();
        } catch (e: any) {
            console.error('Test Email Auth Check Failed:', e);
            // Return detailed 401 for debugging
            return NextResponse.json({
                error: 'Unauthorized',
                debug: 'Session check failed',
                details: e.message
            }, { status: 401 });
        }

        const cronSecret = process.env.CRON_SECRET;
        const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

        // Call the daily maintenance endpoint forcing execution for THIS user only
        // Pass userId to ensure we only process this user's report
        const response = await fetch(`${appUrl}/api/cron/daily-maintenance?force=true&userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${cronSecret}`
            }
        });

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json({ error: 'Cron trigger failed: ' + text }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Test Email Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
