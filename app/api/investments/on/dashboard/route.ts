import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { getONDashboardStats } from '@/app/lib/investments/dashboard-stats';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = await getUserId();
    const stats = await getONDashboardStats(userId);
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
