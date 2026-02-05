import { PrismaClient } from '@prisma/client';
// @ts-ignore
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const SP500_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv';
const CEDEARS_JSON_URL = 'https://raw.githubusercontent.com/ferminrp/google-sheets-argento/main/data/cedears.json';

// Manual overrides and additions for non-S&P 500 companies (e.g. Argentine stocks, ETFs)
const MANUAL_SECTORS: Record<string, string> = {
    // Argentine ADRs
    'MELI': 'Consumer Discretionary', // MercadoLibre
    'GLOB': 'Information Technology', // Globant
    'VIST': 'Energy', // Vista Energy
    'YPF': 'Energy', // YPF
    'PAMP': 'Utilities', // Pampa Energia
    'GGAL': 'Financials', // Grupo Galicia
    'BMA': 'Financials', // Banco Macro
    'SUPV': 'Financials', // Grupo Supervielle
    'BBAR': 'Financials', // BBVA Argentina
    'TGS': 'Utilities', // Transportadora de Gas del Sur (Gas Utilities)
    'CEPU': 'Utilities', // Central Puerto
    'CRESY': 'Real Estate', // Cresud
    'IRS': 'Real Estate', // IRSA
    'EDN': 'Utilities', // Edenor
    'LOMA': 'Materials', // Loma Negra
    'TEO': 'Communication Services', // Telecom Argentina
    'DESP': 'Consumer Discretionary', // Despegar
    'BIOX': 'Materials', // Bioceres
    'TX': 'Materials', // Ternium

    // Popular ETFs
    'SPY': 'ETF',
    'QQQ': 'ETF',
    'DIA': 'ETF',
    'IWM': 'ETF',
    'EEM': 'ETF',
    'XLF': 'Financials',
    'XLE': 'Energy',
    'XLK': 'Information Technology',
    'XLV': 'Health Care',
    'XLI': 'Industrials',
    'XLP': 'Consumer Staples',
    'XLY': 'Consumer Discretionary',
    'XLU': 'Utilities',
    'XLB': 'Materials',
    'XLRE': 'Real Estate',
    'XLC': 'Communication Services',
    'ARKK': 'ETF',
    'GLD': 'Commodities',
    'SLV': 'Commodities',
    'EWZ': 'ETF', // Brazil
    'EWW': 'ETF', // Mexico

    // Others
    'BABA': 'Consumer Discretionary', // Alibaba
    'JD': 'Consumer Discretionary',
    'BIDU': 'Communication Services',
    'TSM': 'Information Technology', // TSMC
    'RIO': 'Materials', // Rio Tinto
    'VALE': 'Materials', // Vale
    'PBR': 'Energy', // Petrobras
    'ITUB': 'Financials', // Itau
    'BBD': 'Financials', // Bradesco
    'SHOP': 'Information Technology', // Shopify
    'SQ': 'Financials', // Block
    'SE': 'Consumer Discretionary', // Sea Limited
    'SPOT': 'Communication Services', // Spotify
    'UBER': 'Industrials', // Uber (GICS moved it recently/sometimes Discretionary, usually Industrials now)
    'DASH': 'Consumer Discretionary',
    'GME': 'Consumer Discretionary',
    'AMC': 'Communication Services',
    'COIN': 'Financials',
    'MSTR': 'Information Technology',
};

async function fetchSp500Sectors(): Promise<Record<string, string>> {
    console.log('Fetching S&P 500 data...');
    const res = await fetch(SP500_URL);
    const text = await res.text();

    const mapping: Record<string, string> = {};
    const lines = text.split('\n');

    // Skip header (index 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parse handle quotes roughly
        // Symbol,Security,GICS Sector,...
        const parts = line.split(',');
        // If symbol has no quotes, it's parts[0]. GICS Sector is parts[2] usually.
        // Assuming standard format without commas in Symbol or Sector names usually.
        // Using a safer regex split if needed, but for now simple split might work for typical S&P 500 list
        // Actually, "Industrial Conglomerates" has no comma using split is fine.
        // "Saint Paul, Minnesota" has comma in later columns.

        let symbol = parts[0];
        let sector = parts[2];

        if (symbol && sector) {
            mapping[symbol] = sector;
        }
    }
    return mapping;
}

async function fetchCedearsList(): Promise<string[]> {
    console.log('Fetching CEDEARs list...');
    const res = await fetch(CEDEARS_JSON_URL);
    const json = await res.json() as any[];
    return json.map((item: any) => item.Cedears); // "Cedears" key holds the ticker
}

async function main() {
    try {
        const sp500Mapping = await fetchSp500Sectors();
        const cedearTickers = await fetchCedearsList();

        console.log(`Loaded ${Object.keys(sp500Mapping).length} S&P 500 sectors.`);
        console.log(`Loaded ${cedearTickers.length} CEDEAR tickers.`);

        // specific hardcoded corrections or popular ones might not be in S&P 500
        // Merge Manual > S&P 500
        const sectorMap = { ...sp500Mapping, ...MANUAL_SECTORS };

        let updatedCount = 0;

        // 1. Update GlobalAsset table
        // We iterate through all GlobalAssets in DB, or we can upsert from the CEDEAR list.
        // Ideally we update what we have.
        const globalAssets = await prisma.globalAsset.findMany();

        console.log(`Processing ${globalAssets.length} GlobalAssets...`);

        for (const asset of globalAssets) {
            const ticker = asset.ticker;
            const sector = sectorMap[ticker];

            if (sector) {
                if (asset.sector !== sector) {
                    await prisma.globalAsset.update({
                        where: { id: asset.id },
                        data: { sector }
                    });
                    process.stdout.write('.');
                    updatedCount++;
                }
            } else {
                // console.log(`No sector found for ${ticker}`);
            }
        }
        console.log(`\nUpdated ${updatedCount} GlobalAssets.`);

        // 2. Update Investment table (User Holdings)
        const investments = await prisma.investment.findMany({
            where: { type: 'CEDEAR' } // Update only CEDEARs for now
        });

        updatedCount = 0;
        console.log(`Processing ${investments.length} User Investments (CEDEARs)...`);

        for (const inv of investments) {
            const ticker = inv.ticker;
            const sector = sectorMap[ticker];

            if (sector) {
                if (inv.sector !== sector) {
                    await prisma.investment.update({
                        where: { id: inv.id },
                        data: { sector }
                    });
                    process.stdout.write('+');
                    updatedCount++;
                }
            }
        }
        console.log(`\nUpdated ${updatedCount} Investments.`);

        // Optional: Seed new CEDEARs from the JSON list if they don't exist?
        // The user requirement was "Populate field 'sector' to assets global".
        // It didn't explicitly say "Add all missing CEDEARs", but it's good practice to update the GlobalAsset catalog if they are missing.
        // For now, I will stick to updating sectors on EXISTING assets to be safe and fast.

    } catch (error) {
        console.error('Error seeding sectors:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
