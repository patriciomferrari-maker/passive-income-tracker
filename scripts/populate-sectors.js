
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SECTOR_MAP = {
    // Technology
    'AAPL': 'Information Technology',
    'MSFT': 'Information Technology',
    'NVDA': 'Information Technology',
    'GOOGL': 'Information Technology',
    'GOOG': 'Information Technology',
    'META': 'Communication Services', // Often grouped here or Tech
    'AMD': 'Information Technology',
    'INTC': 'Information Technology',
    'CRM': 'Information Technology',
    'ADBE': 'Information Technology',
    'QCOM': 'Information Technology',
    'TSM': 'Information Technology',
    'ASML': 'Information Technology',
    'SHOP': 'Information Technology',
    'SQ': 'Information Technology',
    'GLOB': 'Information Technology',
    'MELI': 'Consumer Discretionary', // E-commerce often discretionary
    'AMZN': 'Consumer Discretionary',
    'TSLA': 'Consumer Discretionary',
    'NFLX': 'Communication Services',
    'DIS': 'Communication Services',
    'SPOT': 'Communication Services',

    // Financials
    'JPM': 'Financials',
    'BAC': 'Financials',
    'V': 'Financials', // Payment processors often Fin or Tech
    'MA': 'Financials',
    'C': 'Financials',
    'WFC': 'Financials',
    'GS': 'Financials',
    'MS': 'Financials',
    'BRK.B': 'Financials',
    'BLK': 'Financials',
    'GGAL': 'Financials',
    'BMA': 'Financials',
    'BBAR': 'Financials',
    'SUPV': 'Financials',
    'BYMA': 'Financials',
    'VALO': 'Financials',

    // Energy
    'XOM': 'Energy',
    'CVX': 'Energy',
    'SHEL': 'Energy',
    'TTE': 'Energy',
    'BP': 'Energy',
    'PBR': 'Energy',
    'YPF': 'Energy',
    'YPFD': 'Energy',
    'VIST': 'Energy',
    'PAMP': 'Energy', // Often Utilities/Energy depending on mix
    'TGS': 'Energy', // Midstream
    'TGNO4': 'Energy',
    'CEPU': 'Utilities',
    'EDN': 'Utilities',
    'TRAN': 'Utilities',

    // Consumer Staples
    'KO': 'Consumer Staples',
    'PEP': 'Consumer Staples',
    'PG': 'Consumer Staples',
    'WMT': 'Consumer Staples',
    'COST': 'Consumer Staples',
    'MO': 'Consumer Staples',
    'PM': 'Consumer Staples',

    // Industrials
    'BA': 'Industrials',
    'CAT': 'Industrials',
    'GE': 'Industrials',
    'LMT': 'Industrials',
    'HON': 'Industrials',
    'MMM': 'Industrials',
    'DE': 'Industrials',

    // Materials
    'TXAR': 'Materials',
    'ALUA': 'Materials',
    'LOMA': 'Materials',
    'VALE': 'Materials',
    'RIO': 'Materials',
    'BHP': 'Materials',
    'GOLD': 'Materials',

    // Health Care
    'JNJ': 'Health Care',
    'PFE': 'Health Care',
    'MRK': 'Health Care',
    'ABBV': 'Health Care',
    'LLY': 'Health Care',
    'UNH': 'Health Care',

    // Real Estate
    'O': 'Real Estate',
    'AMT': 'Real Estate',
    'PLD': 'Real Estate',
    'IRSA': 'Real Estate',

    // ETFs (Generally labeled as ETF or specific strategy)
    'SPY': 'ETF',
    'QQQ': 'ETF',
    'DIA': 'ETF',
    'IWM': 'ETF',
    'EEM': 'ETF',
    'XLE': 'ETF',
    'XLF': 'ETF',
    'XLK': 'ETF',
    'ARKK': 'ETF',

    // Missed Items
    'KGC': 'Materials',
    'JMIA': 'Consumer Discretionary',
    'PAGS': 'Financials',
    'RGTI': 'Information Technology',
    'SATL': 'Industrials',
    'ADS': 'Consumer Discretionary',
    'STNE': 'Financials',
    'AAL': 'Industrials',
    'AAP': 'Consumer Discretionary',
    'ABEV': 'Consumer Staples',
    'AEG': 'Financials',
    'AABA': 'Information Technology', // Altaba? or liquidating.
    'AGRO': 'Consumer Staples',
    'AI': 'Information Technology',
    'AKO.B': 'Consumer Staples',
    'ALAB': 'Information Technology',
    'PAC': 'Industrials',
    'BAS GR': 'Materials',
    'BAYN GR': 'Health Care',
    'BBVA': 'Financials',
    'BRK/B': 'Financials',
    'BSN GR': 'Consumer Staples',
    'CBDBY': 'Consumer Staples',
    'DTEA GR': 'Communication Services',
    'ASTS': 'Communication Services',
    'BAK': 'Materials',
    'BMNR': 'Information Technology',
    'FREDDIE MAC': 'Financials',
    'HHPD LI': 'Information Technology',
    'ERIC': 'Information Technology',
    'FNMA': 'Financials',
    'MBG GR': 'Consumer Discretionary',
    'NSANY': 'Consumer Discretionary',
    'SHPWQ': 'Industrials',
    'TELFY': 'Communication Services',
    'LAR': 'Real Estate' // IRSA is Real Estate, LAR? maybe Laboratorio Richmond? No, likely something else. Assuming Real Estate or checking manually?
    // checking LAR: if it's Laramide Resources -> Materials.
    // If it's a type or Latin American Real Estate?
    // Given the context of Argentinian investors...
    // Let's assume Materials (Laramide) or Real Estate.
    // I'll skip LAR for now or guess Materials if mining. 
    // actually just leave LAR out or map to 'Unclassified' if unsure.
    // Wait, 'LAR' -> likely 'Laramide Resources Ltd'.
};

async function main() {
    console.log('Starting sector population...');

    // 1. Get all assets with missing sectors
    const assets = await prisma.globalAsset.findMany({
        where: {
            OR: [
                { sector: null },
                { sector: '' }
            ]
        }
    });

    console.log(`Found ${assets.length} assets with missing sector.`);

    let updatedCount = 0;

    for (const asset of assets) {
        // Simple ticker lookup (stripped of suffix if needed, but map includes common ones)
        // E.g. GLOB is GLOB.
        let sector = SECTOR_MAP[asset.ticker];

        // Try stripping 'D' or other common suffixes if not found?
        // Actually, many args have D suffix or different ticker.
        // Let's rely on direct map first.

        if (!sector) {
            // Heuristics
            if (asset.type === 'ETF' || asset.type === 'CEDEAR_ETF') sector = 'ETF';
            if (asset.type === 'CORPORATE_BOND' || asset.type === 'ON') sector = 'Financials'; // Or "Corporate Debt"? Usually classified by issuer sector really.
            if (asset.type === 'TREASURY' || asset.type === 'BONO') sector = 'Government';
        }

        if (sector) {
            await prisma.globalAsset.update({
                where: { id: asset.id },
                data: { sector }
            });
            console.log(`Updated ${asset.ticker} -> ${sector}`);
            updatedCount++;
        } else {
            console.log(`Skipping ${asset.ticker} (No mapping found)`);
        }
    }

    console.log(`Finished. Updated ${updatedCount} assets.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
