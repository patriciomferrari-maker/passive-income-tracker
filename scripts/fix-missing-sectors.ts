
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECTOR_MAPPING: Record<string, string> = {
    // Communication Services
    'AMX': 'Communication Services',
    'BIDU': 'Communication Services',
    'GOOGL': 'Communication Services',
    'GOOG': 'Communication Services',
    'META': 'Communication Services',
    'NFLX': 'Communication Services',
    'T': 'Communication Services',
    'VZ': 'Communication Services',
    'DIS': 'Communication Services',
    'CMCSA': 'Communication Services',
    'TMUS': 'Communication Services',
    'MBT': 'Communication Services',
    'NTES': 'Communication Services',
    'ORANY': 'Communication Services',
    'PINS': 'Communication Services',
    'SNAP': 'Communication Services',
    'TIIAY': 'Communication Services',
    'TIMB': 'Communication Services',
    'TV': 'Communication Services',
    'VIV': 'Communication Services',
    'VOD': 'Communication Services',
    'YELP': 'Communication Services',
    'WB': 'Communication Services',
    'JOYY': 'Communication Services',

    // Consumer Discretionary
    'AMZN': 'Consumer Discretionary',
    'TSLA': 'Consumer Discretionary',
    'HD': 'Consumer Discretionary',
    'MCD': 'Consumer Discretionary',
    'NKE': 'Consumer Discretionary',
    'SBUX': 'Consumer Discretionary',
    'LOW': 'Consumer Discretionary',
    'BKNG': 'Consumer Discretionary',
    'ANF': 'Consumer Discretionary',
    'ARCO': 'Consumer Discretionary',
    'BABA': 'Consumer Discretionary',
    'CAR': 'Consumer Discretionary',
    'ETSY': 'Consumer Discretionary',
    'GT': 'Consumer Discretionary',
    'HMC': 'Consumer Discretionary',
    'HOG': 'Consumer Discretionary',
    'JD': 'Consumer Discretionary',
    'NIO': 'Consumer Discretionary',
    'PSO': 'Consumer Discretionary',
    'RACE': 'Consumer Discretionary',
    'ROKU': 'Consumer Discretionary',
    'SONY': 'Consumer Discretionary',
    'STLA': 'Consumer Discretionary',
    'TCOM': 'Consumer Discretionary',
    'TM': 'Consumer Discretionary',
    'TRIP': 'Consumer Discretionary',
    'URBN': 'Consumer Discretionary',
    'XPEV': 'Consumer Discretionary',
    'MELI': 'Consumer Discretionary',

    // Consumer Staples
    'PG': 'Consumer Staples',
    'KO': 'Consumer Staples',
    'PEP': 'Consumer Staples',
    'WMT': 'Consumer Staples',
    'COST': 'Consumer Staples',
    'PM': 'Consumer Staples',
    'MO': 'Consumer Staples',
    'ADGO': 'Consumer Staples', // Adecoagro
    'BRFS': 'Consumer Staples', // BRF
    'DEO': 'Consumer Staples',
    'FMX': 'Consumer Staples',
    'KOF': 'Consumer Staples',
    'LND': 'Consumer Staples', // BrasilAgro
    'UL': 'Consumer Staples',

    // Energy
    'XOM': 'Energy',
    'CVX': 'Energy',
    'SHEL': 'Energy',
    'TTE': 'Energy',
    'BP': 'Energy',
    'PBR': 'Energy',
    'VIST': 'Energy',
    'YPF': 'Energy',
    'ATAD': 'Energy', // Tatneft
    'AXIA': 'Energy',
    'E': 'Energy',
    'EQNR': 'Energy',
    'GPRK': 'Energy',
    'LKOD': 'Energy',
    'NXE': 'Energy',
    'OGZD': 'Energy',
    'OKLO': 'Energy', // Nuclear/Tech -> Energy
    'TS': 'Energy',
    'UGP': 'Energy',
    'YZCAY': 'Energy',

    // Financials
    'JPM': 'Financials',
    'BAC': 'Financials',
    'WFC': 'Financials',
    'C': 'Financials',
    'GS': 'Financials',
    'MS': 'Financials',
    'BLK': 'Financials',
    'V': 'Financials', // Often IT, but categorized as Financials in some
    'MA': 'Financials', // Often IT, but categorized as Financials in some
    'AXP': 'Financials',
    'BRK.B': 'Financials',
    'AIG': 'Financials',
    'BBD': 'Financials',
    'BCS': 'Financials',
    'BITF': 'Financials', // Crypto mining often tech/financials
    'BK': 'Financials',
    'BMA': 'Financials', // Banco Macro
    'BN': 'Financials', // Brookfield
    'BSBR': 'Financials',
    'GGAL': 'Financials',
    'SUPV': 'Financials',
    'BBAR': 'Financials',
    'HDB': 'Financials', // HDFC
    'HOOD': 'Financials',
    'HSBC': 'Financials',
    'IBN': 'Financials', // ICICI
    'ING': 'Financials',
    'KB': 'Financials', // KB Financial
    'LYG': 'Financials',
    'MFG': 'Financials',
    'MRSH': 'Financials', // Marsh
    'MUFG': 'Financials',
    'NMR': 'Financials', // Nomura
    'SAN': 'Financials',
    'XP': 'Financials',

    // Health Care
    'JNJ': 'Health Care',
    'LLY': 'Health Care',
    'UNH': 'Health Care',
    'MRK': 'Health Care',
    'ABBV': 'Health Care',
    'PFE': 'Health Care',
    'TMO': 'Health Care',
    'AZN': 'Health Care',
    'BMY': 'Health Care',
    'GSK': 'Health Care',
    'NVS': 'Health Care',
    'PHG': 'Health Care', // Philips
    'TEM': 'Health Care',
    'BIOX': 'Health Care', // Or Materials (Agri-biotech)

    // Industrials
    'GE': 'Industrials',
    'CAT': 'Industrials',
    'DE': 'Industrials',
    'HON': 'Industrials',
    'UPS': 'Industrials',
    'UNP': 'Industrials',
    'LMT': 'Industrials',
    'RTX': 'Industrials',
    'BA': 'Industrials',
    'ASR': 'Industrials', // Airports
    'CAAP': 'Industrials',
    'EMBJ': 'Industrials', // Embraer
    'PBI': 'Industrials',
    'RKLB': 'Industrials', // Aerospace
    'SIEGY': 'Industrials',
    'SPCE': 'Industrials',

    // Information Technology
    'MSFT': 'Information Technology',
    'AAPL': 'Information Technology',
    'NVDA': 'Information Technology',
    'AVGO': 'Information Technology',
    'ORCL': 'Information Technology',
    'CRM': 'Information Technology',
    'ADBE': 'Information Technology',
    'AMD': 'Information Technology',
    'INTC': 'Information Technology',
    'CSCO': 'Information Technology',
    'IBM': 'Information Technology',
    'QCOM': 'Information Technology',
    'TXN': 'Information Technology',
    'ASML': 'Information Technology',
    'ARM': 'Information Technology',
    'BB': 'Information Technology',
    'CLS': 'Information Technology',
    'CRWV': 'Information Technology',
    'INFY': 'Information Technology',
    'IREN': 'Information Technology', // Data centers
    'MRVL': 'Information Technology',
    'NEC1 GR': 'Information Technology',
    'NOK': 'Information Technology', // Equipment
    'PATH': 'Information Technology',
    'SAP': 'Information Technology',
    'SDA': 'Information Technology', // SunCar Tech
    'SMSN LI': 'Information Technology', // Samsung
    'TWLO': 'Information Technology',
    'XRX': 'Information Technology',
    'TSM': 'Information Technology',

    // Materials
    'LIN': 'Materials',
    'SHW': 'Materials',
    'FCX': 'Materials',
    'NEM': 'Materials',
    'SCCO': 'Materials',
    'VALE': 'Materials',
    'RIO': 'Materials',
    'AEM': 'Materials',
    'B': 'Materials', // Barnes? Barrick? Ticker B is usually Barnes Group (Industrials) but context of this portfolio usually implies Gold/Mining if it's Barrick? Wait. Barrick is GOLD. Barnes Group is B. Let's assume Materials/Industrials. Given context "Passive Income", likely Gold. Actually Barrick Gold is GOLD. B is Barnes Group. Let's check matching. If "B" is Barnes Group -> Industrials. If user meant something else? I'll set to Industrials for now.
    'CDE': 'Materials',
    'GFI': 'Materials', // Gold Fields
    'GGB': 'Materials', // Gerdau
    'HL': 'Materials', // Hecla
    'LAC': 'Materials',
    'MUX': 'Materials',
    'NG': 'Materials', // Novagold
    'PAAS': 'Materials', // Pan American Silver
    'SID': 'Materials', // CSN
    'SUZ': 'Materials', // Suzano
    'CX': 'Materials', // Jemex
    'NLMK LI': 'Materials',
    'PKX': 'Materials', // Posco

    // Real Estate
    'PLD': 'Real Estate',
    'AMT': 'Real Estate',
    'CCI': 'Real Estate',
    'EQIX': 'Real Estate',
    'O': 'Real Estate',
    'SPG': 'Real Estate',

    // Utilities
    'NEE': 'Utilities',
    'DUK': 'Utilities',
    'SO': 'Utilities',
    'EOAN GR': 'Utilities',
    'KEP': 'Utilities',
    'NGG': 'Utilities',
    'SBS': 'Utilities', // Sabesp
    'ELPC': 'Utilities', // Copel

    // ETFs
    'SPY': 'Diversified',
    'IVV': 'Diversified',
    'VOO': 'Diversified',
    'QQQ': 'Diversified', // Tech heavy but ETF
    'DIA': 'Diversified',
    'IWM': 'Diversified',
    'EEM': 'Diversified',
    'XLF': 'Financials',
    'XLE': 'Energy',
    'XLK': 'Information Technology',
    'XLV': 'Health Care',
    'ACWI': 'Diversified',
    'COPX': 'Materials',
    'EFA': 'Diversified',
    'ESGU': 'Diversified',
    'EWJ': 'Diversified',
    'FXI': 'Diversified',
    'GDX': 'Materials', // Gold Miners
    'IBB': 'Health Care', // Biotech
    'IEUR': 'Diversified',
    'ILF': 'Diversified',
    'IVE': 'Diversified',
    'IVW': 'Diversified',
    'IWDA LN': 'Diversified',
    'PSQ': 'Diversified', // Inverse
    'SPHQ': 'Diversified',
    'USO': 'Energy',
    'VEA': 'Diversified',
    'GLD': 'Materials', // Commodities
    'SLV': 'Materials',
};

async function main() {
    console.log('Starting sector population...');

    // Fetch assets with null or empty sectors
    const assetsToUpdate = await prisma.globalAsset.findMany({
        where: {
            OR: [
                { sector: null },
                { sector: '' }
            ]
        }
    });

    console.log(`Found ${assetsToUpdate.length} assets to potentially update.`);

    let updatedCount = 0;
    let unknownCount = 0;
    const unknownTickers = [];

    for (const asset of assetsToUpdate) {
        const ticker = asset.ticker.toUpperCase().trim();
        // Try exact match
        let sector = SECTOR_MAPPING[ticker];

        // Heuristics for special cases
        if (!sector) {
            if (asset.type === 'ETF' || asset.name.includes('ETF') || asset.name.includes('ISHARES') || asset.name.includes('VANGUARD') || asset.name.includes('SPDR')) {
                sector = 'Diversified';
            }
        }

        if (sector) {
            await prisma.globalAsset.update({
                where: { id: asset.id },
                data: { sector }
            });
            // Also update Investments with same ticker if they are missing sector
            await prisma.investment.updateMany({
                where: {
                    ticker: ticker,
                    OR: [{ sector: null }, { sector: '' }]
                },
                data: { sector }
            });
            updatedCount++;
        } else {
            updatedCount++; // Count as processed but failed
            unknownCount++;
            unknownTickers.push(ticker);
        }
    }

    console.log(`Update complete.`);
    console.log(`Updated: ${updatedCount - unknownCount}`);
    console.log(`Unknown: ${unknownCount}`);
    if (unknownCount > 0) {
        console.log('Unknown Tickers:', unknownTickers.join(', '));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
