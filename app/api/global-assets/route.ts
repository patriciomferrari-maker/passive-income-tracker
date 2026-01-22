import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search')?.toLowerCase();
        const type = searchParams.get('type');

        // Debug log
        console.log(`[GlobalAssets API] User: ${userId}, Search: "${search}", Type: "${type}"`);

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
        const assets = await prisma.globalAsset.findMany({
            where,
            orderBy: { ticker: 'asc' },
            include: {
                // Check if user holds this asset
                holders: {
                    where: { userId },
                    select: { id: true }
                }
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
            inPortfolio: asset.holders.length > 0
        }));

        return NextResponse.json(formattedAssets);

    } catch (error) {
        console.error('Error fetching global assets:', error);
        return unauthorized();
    }
}
