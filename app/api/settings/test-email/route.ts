
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// This is a proxy route to trigger the CRON logic manually from the frontend
// In a real app with Auth, we would check session here.
// Since we don't have auth yet, this is "public" but obscure.

export async function POST() {
    try {
        // We invoke the cron logic internally or duplicate it? 
        // Invoking via HTTP requires the SECRET, which we have in env.

        const cronSecret = process.env.CRON_SECRET;
        const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

        // Call the cron endpoint with "force=true" query param or similar to bypass date check?
        // Or just rely on the cron endpoint logic to detect "simulation"?
        // Let's modify the cron endpoint first to support a "force" parameter.

        const response = await fetch(`${appUrl}/api/cron/monthly-report?force=true`, {
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
