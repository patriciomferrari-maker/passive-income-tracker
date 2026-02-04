import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // 1. Fetch Investments (ONs, Treasuries)
        // We need transactions to calculate quantity
        const investments = await prisma.investment.findMany({
            where: { userId },
            include: { transactions: true }
        });

        // 2. Fetch User Holdings for Global Assets (CEDEARs, Stocks)
        // GlobalAsset is shared; UserHolding links user to asset & transactions
        const holdings = await prisma.userHolding.findMany({
            where: { userId },
            include: {
                asset: true,
                transactions: true
            }
        });

        // 3. Aggregate by Sector
        const sectorMap = new Map<string, number>();
        const USD_ARS = 1220; // Fallback hardcoded if needed, or we could fetch it.

        // Process Investments
        for (const inv of investments) {
            // Calculate signed quantity
            const quantity = inv.transactions.reduce((acc, t) => {
                if (t.type === 'BUY') return acc + t.quantity;
                if (t.type === 'SELL') return acc - t.quantity;
                return acc;
            }, 0);

            if (quantity <= 0) continue;

            const price = inv.lastPrice || 0;
            let value = quantity * price;

            // Simple currency conversion
            if (inv.currency === 'ARS') {
                value = value / USD_ARS;
            }

            const sector = inv.sector || 'Unclassified';
            sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
        }

        // Process Global Assets
        for (const holding of holdings) {
            const quantity = holding.transactions.reduce((acc, t) => {
                // GlobalAssetTransaction might use slightly different fields or logic?
                // Checking schema: type string (BUY, SELL)
                if (t.type === 'BUY') return acc + t.quantity;
                if (t.type === 'SELL') return acc - t.quantity;
                return acc;
            }, 0);

            if (quantity <= 0) continue;

            const price = holding.asset.lastPrice || 0;
            let value = quantity * price;

            if (holding.asset.currency === 'ARS') {
                value = value / USD_ARS;
            }

            const sector = holding.asset.sector || 'Unclassified';
            sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
        }

        const result = Array.from(sectorMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Error in sector analytics:", error);
        // CRITICAL: Return an empty array on error so UI doesn't crash with "map is not a function"
        return NextResponse.json([], { status: 200 });
    }
}
