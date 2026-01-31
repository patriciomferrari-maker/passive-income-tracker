
import { NextResponse } from 'next/server';
import { scrapeAllUtilities } from '@/app/lib/utility-service';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout for scrapers

export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // Optional: Parse body for specific property ID
        const body = await request.json().catch(() => ({}));
        const { propertyId } = body;

        console.log(`[API] Triggering utility check for user ${userId} ${propertyId ? `(Prop: ${propertyId})` : '(All)'}`);

        const results = await scrapeAllUtilities(propertyId);

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('[API] Utility Check Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
