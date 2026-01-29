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

/**
 * Returns an array of tickers and names that the user has or had in their portfolio (at least one transaction)
 */
export async function getUserHistoricalTickers(userId: string): Promise<Array<{ ticker: string, name: string }>> {
    try {
        // 1. Fetch all Investments for this user
        const investments = await prisma.investment.findMany({
            where: { userId },
            select: { ticker: true, name: true }
        });

        // 2. Fetch all GlobalAsset holdings for this user
        const holdings = await prisma.userHolding.findMany({
            where: { userId },
            include: { asset: { select: { ticker: true, name: true } } }
        });

        const tickerMap = new Map<string, string>();

        investments.forEach(i => {
            tickerMap.set(i.ticker, i.name);
        });

        holdings.forEach(h => {
            tickerMap.set(h.asset.ticker, h.asset.name);
        });

        const sortedTickers = Array.from(tickerMap.entries())
            .map(([ticker, name]) => ({ ticker, name }))
            .sort((a, b) => a.ticker.localeCompare(b.ticker));

        return sortedTickers;
    } catch (error) {
        console.error('Error fetching historical tickers:', error);
        return [];
    }
}
