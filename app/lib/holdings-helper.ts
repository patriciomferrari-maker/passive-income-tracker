import { prisma } from '@/lib/prisma';

/**
 * Returns an array of tickers that the user currently has in their portfolio (quantity > 0)
 */
export async function getUserActiveTickers(userId: string): Promise<string[]> {
    try {
        // Fetch UserHoldings for GlobalAssets (CEDEARs, ETFs, etc.)
        const holdings = await prisma.userHolding.findMany({
            where: { userId },
            include: {
                asset: true,
                transactions: true
            }
        });

        const activeTickers = holdings
            .filter(h => {
                const quantity = h.transactions.reduce((sum, t) => {
                    return sum + (t.type === 'BUY' ? t.quantity : -t.quantity);
                }, 0);
                return quantity > 0;
            })
            .map(h => h.asset.ticker);

        return activeTickers;
    } catch (error) {
        console.error('Error fetching active tickers:', error);
        return [];
    }
}
