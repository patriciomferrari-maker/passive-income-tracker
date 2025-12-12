
import { NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helper';
import { updateONs, updateTreasuries } from '@/app/lib/market-data';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        // Allow unauthenticated for now or assume internal use? 
        // Better to require auth.
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        console.log(`Syncing market data for user ${userId}...`);

        // Run updates in parallel
        const [ons, treasuries] = await Promise.all([
            updateONs(userId),
            updateTreasuries(userId)
        ]);

        return NextResponse.json({
            success: true,
            results: {
                onsCount: ons.length,
                treasuriesCount: treasuries.length,
                details: [...ons, ...treasuries]
            }
        });
    } catch (error: any) {
        console.error('Manual Sync Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
