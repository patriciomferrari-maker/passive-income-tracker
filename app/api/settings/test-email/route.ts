
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// This is a proxy route to trigger the CRON logic manually from the frontend
// In a real app with Auth, we would check session here.
// Since we don't have auth yet, this is "public" but obscure.

import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function POST() {
    try {
        let userId: string;
        try {
            userId = await getUserId();
        } catch {
            return unauthorized();
        }

        const cronSecret = process.env.CRON_SECRET;
        const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

        // Call the daily maintenance endpoint forcing execution for THIS user only
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
