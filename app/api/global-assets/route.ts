import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        // If no user ID, we proceed as guest (read-only, no portfolio info)

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search')?.toLowerCase();
        const type = searchParams.get('type');

        // Debug log
        console.log(`[GlobalAssets API] User: ${userId || 'GUEST'}, Search: "${search}", Type: "${type}"`);

        // Build filter query
        const where: any = {};

        if (search && search.trim() !== '') {
            where.OR = [
                { ticker: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (type && type !== 'ALL') {
            where.type = type;
        }

        console.log('[GlobalAssets API] Where clause:', JSON.stringify(where));

        // Get assets
        // Only include holders info if we have a logged in user
        const assets = await prisma.globalAsset.findMany({
            where,
            orderBy: { ticker: 'asc' },
            include: {
                userHoldings: userId ? {
                    where: { userId },
                    select: { id: true }
                } : false
            }
        });

        // Transform response
        const formattedAssets = assets.map(asset => ({
            id: asset.id,
            ticker: asset.ticker,
            name: asset.name,
            type: asset.type,
            currency: asset.currency,
            market: asset.market,
            lastPrice: asset.lastPrice,
            lastPriceDate: asset.lastPriceDate,
            ratio: asset.ratio,
            inPortfolio: userId && asset.userHoldings ? asset.userHoldings.length > 0 : false
        }));

        return NextResponse.json(formattedAssets);

    } catch (error: any) {
        console.error('Error fetching global assets:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            details: error.toString()
        }, { status: 500 });
    }
}
