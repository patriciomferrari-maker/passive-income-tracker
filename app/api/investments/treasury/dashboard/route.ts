import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { getUSDashboardStats } from '@/app/lib/investments/treasury-dashboard-stats';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        const stats = await getUSDashboardStats(userId);
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (error instanceof Error && error.message === 'Unauthorized') return unauthorized();
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

