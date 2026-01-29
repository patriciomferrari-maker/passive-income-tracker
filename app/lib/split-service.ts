import { prisma } from '@/lib/prisma';
import { scrapeComafiCedears } from '@/lib/scrapers/comafi-cedears';

/**
 * Parses a ratio string (e.g., "10:1") into a numeric divisor (e.g., 10).
 * Returns null if invalid.
 */
function parseRatio(ratioStr: string): number | null {
    if (!ratioStr) return null;
    const parts = ratioStr.split(':');
    if (parts.length < 1) return null;
    const val = parseFloat(parts[0]);
    if (isNaN(val) || val <= 0) return null;
    return val;
}

/**
 * Detects CEDEAR ratio changes by comparing Comafi data with DB.
 * If a change is detected (split/reverse split), it updates the GlobalAsset
 * and adjusts all user holdings (Investment and UserHolding transactions).
 */
export async function detectAndApplySplits() {
    console.log('🔄 [SplitService] Starting CEDEAR split check...');
    const logs: string[] = [];
    let splitsApplied = 0;

    try {
        // 1. Fetch official data
        const comafiAssets = await scrapeComafiCedears();
        console.log(`🔄 [SplitService] Fetched ${comafiAssets.length} assets from Comafi.`);

        // 2. Fetch current DB state
        // We only care about assets that already exist and have a ratio
        const dbAssets = await prisma.globalAsset.findMany({
            where: {
                type: { in: ['CEDEAR', 'ETF'] },
                market: 'ARG'
            }
        });

        // Map for fast lookup
        const dbAssetMap = new Map(dbAssets.map(a => [a.ticker, a]));

        // 3. Compare
        for (const freshAsset of comafiAssets) {
            const dbAsset = dbAssetMap.get(freshAsset.ticker);
            if (!dbAsset) continue; // New asset, catalog sync will handle it. We only split existing ones.

            const oldRatioStr = dbAsset.ratio;
            const newRatioStr = freshAsset.ratio;

            if (oldRatioStr !== newRatioStr) {
                // Formatting difference or actual change?
                const oldVal = parseRatio(oldRatioStr || '1:1'); // Default to 1:1 if null, cautious
                const newVal = parseRatio(newRatioStr);

                if (oldVal && newVal && oldVal !== newVal) {
                    console.warn(`⚠️ [SplitService] SPLIT DETECTED for ${dbAsset.ticker}: ${oldRatioStr} -> ${newRatioStr}`);

                    // Logic: 
                    // Old: 10:1 (10 cedears = 1 underlying)
                    // New: 20:1 (20 cedears = 1 underlying)
                    // Multiplier = 20 / 10 = 2.
                    // User has 100 nominals -> Now has 200.
                    // Price was $1000 -> Now is $500.

                    const multiplier = newVal / oldVal;

                    if (multiplier !== 1) {
                        await applySplitToAsset(dbAsset.id, dbAsset.ticker, oldRatioStr || '?', newRatioStr, multiplier);
                        splitsApplied++;
                        logs.push(`Applied split for ${dbAsset.ticker} (${oldRatioStr} -> ${newRatioStr}, x${multiplier})`);
                    }
                } else if (!oldVal && newVal) {
                    // Just updating missing ratio, no split logic needed usually, just catalog update.
                    // But if user has holdings, verify if we should assume it is a correction or initial set.
                    // Safe bet: just update the catalog ratio without modifying holdings if old was missing.
                    await prisma.globalAsset.update({
                        where: { id: dbAsset.id },
                        data: { ratio: newRatioStr }
                    });
                    console.log(`ℹ️ [SplitService] Updated missing ratio for ${dbAsset.ticker}: ${newRatioStr}`);
                }
            }
        }

    } catch (error: any) {
        console.error('❌ [SplitService] Error:', error);
        throw error;
    }

    console.log(`✅ [SplitService] Completed. Splits applied: ${splitsApplied}`);
    return { applied: splitsApplied, logs };
}

export async function applySplitToAsset(assetId: string, ticker: string, oldRatio: string, newRatio: string, multiplier: number) {
    // Transactional application
    await prisma.$transaction(async (tx) => {
        // 1. Log History
        await tx.assetSplitHistory.create({
            data: {
                ticker,
                oldRatio,
                newRatio,
                multiplier,
                applied: true
            }
        });

        // 2. Update Global Asset Ratio
        await tx.globalAsset.update({
            where: { id: assetId },
            data: { ratio: newRatio }
        });

        // 3. Update LEGACY Investments (Investments Table)
        // Find investments with this ticker (User-specific)
        const legacyInvestments = await tx.investment.findMany({
            where: { ticker: ticker } // Ticker is inconsistent in legacy but usually matches
        });

        for (const inv of legacyInvestments) {
            // Update Quantity
            // Update Transactions (Quantity & Price)
            // Ideally we iterate and update.
            // But for performance, we can do batch updates if Prisma supported it cleanly, or loop.

            // Update Transactions attached to this investment
            // Quantity * multiplier
            // Price / multiplier
            // Commission? Keeps same total? Yes.
            const transactions = await tx.transaction.findMany({ where: { investmentId: inv.id } });
            for (const t of transactions) {
                await tx.transaction.update({
                    where: { id: t.id },
                    data: {
                        quantity: t.quantity * multiplier,
                        price: t.price / multiplier
                    }
                });
            }
        }

        // 4. Update NEW System (UserHoldings & GlobalAssetTransactions)
        const holdings = await tx.userHolding.findMany({
            where: { assetId: assetId },
            include: { transactions: true }
        });

        for (const holding of holdings) {
            // UserHolding table itself doesn't have quantity, it is derived from transactions.
            // So we just update transactions.
            for (const t of holding.transactions) {
                await tx.globalAssetTransaction.update({
                    where: { id: t.id },
                    data: {
                        quantity: t.quantity * multiplier,
                        price: t.price / multiplier
                    }
                });
            }
        }
    });
}
