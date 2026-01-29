import { prisma } from '@/lib/prisma';

/**
 * Returns an array of tickers that the user currently has in their portfolio (quantity > 0)
 */
export async function getUserActiveTickers(userId: string): Promise<string[]> {
    try {
        // 1. Fetch Investments (ONs, Treasuries, etc.)
        const investments = await prisma.investment.findMany({
            where: { userId },
            include: {
                transactions: true
            }
        });

        const activeInvestmentTickers = investments
            .filter(i => {
                const quantity = i.transactions.reduce((sum, t) => {
                    return sum + (t.type === 'BUY' ? t.quantity : -t.quantity);
                }, 0);
                return quantity > 0.000001;
            })
            .map(i => i.ticker);

        // 2. Fetch UserHoldings for GlobalAssets (CEDEARs, ETFs, etc.)
        const holdings = await prisma.userHolding.findMany({
            where: { userId },
            include: {
                asset: true,
                transactions: true
            }
        });

        const activeGATickers = holdings
            .filter(h => {
                const quantity = h.transactions.reduce((sum, t) => {
                    return sum + (t.type === 'BUY' ? t.quantity : -t.quantity);
                }, 0);
                return quantity > 0.000001;
            })
            .map(h => h.asset.ticker);

        // Merge and return unique tickers
        return Array.from(new Set([...activeInvestmentTickers, ...activeGATickers]));
    } catch (error) {
        console.error('Error fetching active tickers:', error);
        return [];
    }
}
