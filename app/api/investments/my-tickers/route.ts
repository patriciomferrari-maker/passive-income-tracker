import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helper';
import { getUserHistoricalTickers } from '@/app/lib/holdings-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tickers = await getUserHistoricalTickers(userId);
        return NextResponse.json(tickers);
    } catch (error) {
        console.error('Error in /api/investments/my-tickers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
