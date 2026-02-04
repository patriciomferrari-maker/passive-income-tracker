
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ASSET_SECTORS: Record<string, string> = {
    // Energy
    'YPF': 'Energy', 'YPFD': 'Energy', 'VIST': 'Energy', 'PAMP': 'Energy', 'PBR': 'Energy', 'XOM': 'Energy', 'CVX': 'Energy', 'SHEL': 'Energy', 'TTE': 'Energy', 'BP': 'Energy',
    // Technology
    'AAPL': 'Technology', 'MSFT': 'Technology', 'NVDA': 'Technology', 'AMD': 'Technology', 'INTC': 'Technology', 'AVGO': 'Technology', 'QCOM': 'Technology', 'CSCO': 'Technology', 'ADBE': 'Technology', 'CRM': 'Technology', 'ORCL': 'Technology', 'IBM': 'Technology', 'TXN': 'Technology', 'NOW': 'Technology', 'UBER': 'Technology', 'SQ': 'Technology', 'PLTR': 'Technology', 'GLOB': 'Technology', 'SHOP': 'Technology', 'PANW': 'Technology', 'SNOW': 'Technology', 'CRWD': 'Technology', 'TEAM': 'Technology', 'ZM': 'Technology', 'DOCU': 'Technology',
    // Financials
    'GGAL': 'Financials', 'BMA': 'Financials', 'BBAR': 'Financials', 'SUPV': 'Financials', 'JPM': 'Financials', 'BAC': 'Financials', 'WFC': 'Financials', 'C': 'Financials', 'GS': 'Financials', 'MS': 'Financials', 'BLK': 'Financials', 'V': 'Financials', 'MA': 'Financials', 'AXP': 'Financials', 'PYPL': 'Financials', 'BRK.B': 'Financials', 'BRKB': 'Financials', 'NU': 'Financials',
    // Communication Services
    'GOOGL': 'Communication Services', 'GOOG': 'Communication Services', 'META': 'Communication Services', 'NFLX': 'Communication Services', 'DIS': 'Communication Services', 'TMUS': 'Communication Services', 'CMCSA': 'Communication Services', 'VZ': 'Communication Services', 'T': 'Communication Services', 'CHTR': 'Communication Services',
    // Consumer Discretionary
    'AMZN': 'Consumer Discretionary', 'TSLA': 'Consumer Discretionary', 'MELI': 'Consumer Discretionary', 'HD': 'Consumer Discretionary', 'MCD': 'Consumer Discretionary', 'NKE': 'Consumer Discretionary', 'SBUX': 'Consumer Discretionary', 'LOW': 'Consumer Discretionary', 'BKNG': 'Consumer Discretionary', 'TJX': 'Consumer Discretionary', 'JD': 'Consumer Discretionary', 'BABA': 'Consumer Discretionary', 'PDD': 'Consumer Discretionary',
    // Consumer Staples
    'KO': 'Consumer Staples', 'PEP': 'Consumer Staples', 'PG': 'Consumer Staples', 'WMT': 'Consumer Staples', 'COST': 'Consumer Staples', 'PM': 'Consumer Staples', 'MO': 'Consumer Staples', 'CL': 'Consumer Staples', 'EL': 'Consumer Staples', 'KMB': 'Consumer Staples',
    // Health Care
    'LLY': 'Health Care', 'UNH': 'Health Care', 'JNJ': 'Health Care', 'MRK': 'Health Care', 'ABBV': 'Health Care', 'PFE': 'Health Care', 'TMO': 'Health Care', 'DHR': 'Health Care', 'BMY': 'Health Care', 'AMGN': 'Health Care', 'GILD': 'Health Care', 'ISRG': 'Health Care', 'VRTX': 'Health Care', 'REGN': 'Health Care', 'ZTS': 'Health Care', 'CVS': 'Health Care',
    // Industrials
    'BA': 'Industrials', 'CAT': 'Industrials', 'GE': 'Industrials', 'HON': 'Industrials', 'UNP': 'Industrials', 'UPS': 'Industrials', 'DE': 'Industrials', 'LMT': 'Industrials', 'RTX': 'Industrials', 'MMM': 'Industrials', 'ADP': 'Industrials',
    // Materials
    'LIN': 'Materials', 'SCCO': 'Materials', 'VALE': 'Materials', 'RIO': 'Materials', 'BHP': 'Materials', 'FCX': 'Materials', 'NEM': 'Materials', 'SHW': 'Materials', 'APD': 'Materials', 'ECL': 'Materials', 'GOLD': 'Materials', 'HMY': 'Materials',
    // Real Estate
    'PLD': 'Real Estate', 'AMT': 'Real Estate', 'EQIX': 'Real Estate', 'CCI': 'Real Estate', 'PSA': 'Real Estate', 'O': 'Real Estate', 'SPG': 'Real Estate', 'WELL': 'Real Estate', 'DLR': 'Real Estate',
    // Utilities
    'NEE': 'Utilities', 'SO': 'Utilities', 'DUK': 'Utilities', 'D': 'Utilities', 'AEP': 'Utilities', 'EXC': 'Utilities',
    // ETFs (Broad)
    'SPY': 'Fondo Indexado', 'QQQ': 'Fondo Indexado', 'DIA': 'Fondo Indexado', 'IWM': 'Fondo Indexado', 'VOO': 'Fondo Indexado', 'IVV': 'Fondo Indexado', 'VTI': 'Fondo Indexado',
    // Crypto
    'BTC': 'Cripto', 'ETH': 'Cripto', 'IBIT': 'Cripto', 'ETHA': 'Cripto', 'BITF': 'Cripto', 'HUT': 'Cripto', 'RIOT': 'Cripto', 'COIN': 'Crypto'
};

async function main() {
    console.log('Seeding Sectors...');

    let updatedCount = 0;

    for (const [ticker, sector] of Object.entries(ASSET_SECTORS)) {
        // 1. Update Global Assets
        const globalResult = await prisma.globalAsset.updateMany({
            where: {
                OR: [
                    { ticker: ticker },
                    { ticker: ticker + '.BA' } // Try with .BA suffix too if needed? Usually we store cleaner tickers
                ]
            },
            data: { sector }
        });

        // 2. Update Investments
        const investResult = await prisma.investment.updateMany({
            where: {
                OR: [
                    { ticker: ticker },
                    { ticker: { startsWith: ticker + ' ' } } // In case of "AL30 5079"
                ]
            },
            data: { sector }
        });

        if (globalResult.count > 0 || investResult.count > 0) {
            console.log(`Updated ${ticker} -> ${sector} (Global: ${globalResult.count}, Inv: ${investResult.count})`);
            updatedCount += globalResult.count + investResult.count;
        }
    }

    console.log(`Finished. Total records updated: ${updatedCount}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
