
import { NextResponse } from 'next/server';
import { updateActiveAssetsOnly } from '@/app/lib/market-data';

export const maxDuration = 60; // Increase timeout for batch processing

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const result = await updateActiveAssetsOnly();
        return NextResponse.json({ success: true, ...result });

    } catch (error: any) {
        console.error('Optimized Update Job Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
