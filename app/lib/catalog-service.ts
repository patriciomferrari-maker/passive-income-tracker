
import { prisma } from '@/lib/prisma';
import { scrapeComafiCedears, ComafiAsset } from '@/lib/scrapers/comafi-cedears';

/**
 * Synchronizes the GlobalAsset catalog with official data from Banco Comafi.
 * Detects new tickers and updates ratios for existing ones.
 */
export async function syncCedearCatalog() {
    console.log('🔄 [CatalogService] Starting CEDEAR/ETF catalog synchronization...');
    let addedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    try {
        const comafiAssets = await scrapeComafiCedears();
        console.log(`🔄 [CatalogService] Scraped ${comafiAssets.length} assets from Comafi.`);
        console.log('🔄 [CatalogService] Starting loop to process assets...');
        let count = 0;
        for (const asset of comafiAssets) {
            count++;
            if (count % 50 === 0) console.log(`🔄 [CatalogService] Processing asset ${count}/${comafiAssets.length}...`);
            try {
                const existing = await prisma.globalAsset.findUnique({
                    where: { ticker: asset.ticker }
                });

                if (existing) {
                    // Update if ratio or name changed
                    if (existing.ratio !== asset.ratio || existing.name !== asset.name) {
                        await prisma.globalAsset.update({
                            where: { id: existing.id },
                            data: {
                                name: asset.name,
                                ratio: asset.ratio,
                                type: asset.type // Just in case it changed from CEDEAR to ETF or vice versa
                            }
                        });
                        updatedCount++;
                    }
                } else {
                    // Create new asset
                    await prisma.globalAsset.create({
                        data: {
                            ticker: asset.ticker,
                            name: asset.name,
                            ratio: asset.ratio,
                            type: asset.type,
                            market: 'ARG',
                            currency: 'ARS'
                        }
                    });
                    addedCount++;
                }
            } catch (err: any) {
                console.error(`❌ [CatalogService] Error processing ticker ${asset.ticker}:`, err.message);
                errorCount++;
            }
        }

        console.log(`✅ [CatalogService] Sync completed. Added: ${addedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`);
        return { addedCount, updatedCount, errorCount };

    } catch (error: any) {
        console.error('❌ [CatalogService] Sync failed:', error.message);
        throw error;
    }
}
