import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // 1. Fetch Investments (ONs, Treasuries)
        const investments = await prisma.investment.findMany({
            where: { userId, quantity: { gt: 0 } },
            include: { assetPrices: true } // Need price for valuation
        });

        // 2. Fetch Global Assets (CEDEARs, Stocks)
        const globalAssets = await prisma.globalAsset.findMany({
            where: { userId, quantity: { gt: 0 } },
            include: { stockData: true } // Need price
        });

        // 3. Aggregate by Sector
        const sectorMap = new Map<string, number>();

        // Process Investments
        investments.forEach(inv => {
            const price = inv.assetPrices?.[0]?.price || 0; // Assuming recent price or we need logic
            const value = inv.quantity * price;
            // Currency conversion? Assuming basic USD/ARS handling here or simplified.
            // If ARS, divide by 1200 approx for sector weight logic, or keep all in same currency.
            // Let's assume most are USD for this snippet or we'd need exchange rates.
            // We'll use a rough fallback for MVP.
            let finalValue = value;
            if (inv.currency === 'ARS') finalValue = value / 1200;

            const sector = inv.sector || 'Unclassified';
            sectorMap.set(sector, (sectorMap.get(sector) || 0) + finalValue);
        });

        // Process Global Assets
        globalAssets.forEach(asset => {
            const price = asset.stockData?.price || 0;
            const value = asset.quantity * price;
            // Global Assets are usually CEDEARs (ARS) or Stocks (USD).
            let finalValue = value;
            if (asset.currency === 'ARS') finalValue = value / 1200;

            const sector = asset.sector || 'Unclassified';
            sectorMap.set(sector, (sectorMap.get(sector) || 0) + finalValue);
        });

        const result = Array.from(sectorMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return NextResponse.json(result);

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
