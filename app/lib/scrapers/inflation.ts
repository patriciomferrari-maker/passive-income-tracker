
import * as cheerio from 'cheerio';

export interface InflationDataPoint {
    year: number;
    month: number;
    value: number;
    interannualValue?: number; // NEW: Interannual inflation
}

const MONTH_MAP: Record<string, number> = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

async function scrapeYearData(year: number): Promise<InflationDataPoint[]> {
    try {
        const url = `https://datosmacro.expansion.com/ipc-paises/argentina?sector=IPC+General&sc=IPC-IG&anio=${year}`;
        const response = await fetch(url, {
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch datosmacro for year ${year}: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const data: InflationDataPoint[] = [];

        // Find table with inflation data
        $('table tbody tr').each((_, row) => {
            const cells = $(row).find('td');
            // Based on observation:
            // 0: Date
            // 1: Interanual Value
            // 2: Interanual Bar
            // 3: Acum Value
            // 4: Acum Bar
            // 5: Monthly Variation Value
            if (cells.length >= 6) {
                const dateText = $(cells[0]).text().trim().toLowerCase(); // e.g. "octubre 2025"
                const interannualText = $(cells[1]).text().trim(); // e.g. "31,3%" - INTERANUAL
                const variationText = $(cells[5]).text().trim(); // e.g. "2,7%" - MENSUAL

                // Parse Date
                const yearMatch = dateText.match(/20\d{2}/);
                if (!yearMatch) return;

                const parsedYear = parseInt(yearMatch[0]);
                let month = 0;

                for (const [name, num] of Object.entries(MONTH_MAP)) {
                    if (dateText.includes(name)) {
                        month = num;
                        break;
                    }
                }

                if (month === 0) return;

                // Parse Monthly Variation
                const cleanVariation = variationText.replace('%', '').replace(',', '.').trim();
                const value = parseFloat(cleanVariation);

                // Parse Interannual Variation
                const cleanInterannual = interannualText.replace('%', '').replace(',', '.').trim();
                const interannualValue = parseFloat(cleanInterannual);

                if (!isNaN(value)) {
                    data.push({
                        year: parsedYear,
                        month,
                        value,
                        interannualValue: !isNaN(interannualValue) ? interannualValue : undefined
                    });
                }
            }
        });

        return data;
    } catch (error) {
        console.error(`Error scraping inflation data for year ${year}:`, error);
        return [];
    }
}

export async function scrapeInflationData(): Promise<InflationDataPoint[]> {
    const currentYear = new Date().getFullYear();
    const startYear = 2019;
    const allData: InflationDataPoint[] = [];

    // Scrape data for each year from 2019 to current year
    for (let year = startYear; year <= currentYear; year++) {
        console.log(`Scraping inflation data for year ${year}...`);
        const yearData = await scrapeYearData(year);
        allData.push(...yearData);

        // Small delay between requests to be respectful
        if (year < currentYear) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Deduplicate by year+month (keep last occurrence)
    const uniqueData = new Map<string, InflationDataPoint>();
    allData.forEach(item => {
        const key = `${item.year}-${item.month}`;
        uniqueData.set(key, item);
    });

    const deduplicatedData = Array.from(uniqueData.values());
    console.log(`Total inflation data points scraped: ${allData.length}`);
    console.log(`After deduplication: ${deduplicatedData.length}`);

    return deduplicatedData;
}
