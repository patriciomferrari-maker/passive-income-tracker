
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

export async function scrapeInflationData(): Promise<InflationDataPoint[]> {
    try {
        const response = await fetch('https://datosmacro.expansion.com/ipc-paises/argentina?sc=IPC-IG', {
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch datosmacro: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const data: InflationDataPoint[] = [];

        // Find table with 'IPC - IPC General' in header or caption, 
        // but based on inspection it seems to be the first main table.
        // We look for rows where we can extract a date and a variation.

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
                // Usually format is "Month Year". Sometimes data might have day.
                // We look for month name and year.
                const yearMatch = dateText.match(/20\d{2}/);
                if (!yearMatch) return;

                const year = parseInt(yearMatch[0]);
                let month = 0;

                for (const [name, num] of Object.entries(MONTH_MAP)) {
                    if (dateText.includes(name)) {
                        month = num;
                        break;
                    }
                }

                if (month === 0) return;

                // Parse Monthly Variation
                // Remove % and replace comma with dot
                const cleanVariation = variationText.replace('%', '').replace(',', '.').trim();
                const value = parseFloat(cleanVariation);

                // Parse Interannual Variation
                const cleanInterannual = interannualText.replace('%', '').replace(',', '.').trim();
                const interannualValue = parseFloat(cleanInterannual);

                if (!isNaN(value)) {
                    data.push({
                        year,
                        month,
                        value,
                        interannualValue: !isNaN(interannualValue) ? interannualValue : undefined
                    });
                }
            }
        });

        return data;
    } catch (error) {
        console.error('Error scraping inflation data:', error);
        throw error;
    }
}
