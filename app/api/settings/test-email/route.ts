
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// This is a proxy route to trigger the CRON logic manually from the frontend
// In a real app with Auth, we would check session here.
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
