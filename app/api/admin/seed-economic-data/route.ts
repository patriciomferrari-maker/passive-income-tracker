import { NextResponse } from 'next/server';
import { seedEconomicData } from '@/scripts/legacy/seed-economic-data';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        await seedEconomicData();

        return NextResponse.json({
            success: true,
            message: 'Economic data seeded successfully'
        });
    } catch (error) {
        console.error('Error in seed endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to seed economic data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
