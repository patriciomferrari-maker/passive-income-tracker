
export interface DollarDataPoint {
    date: Date;
    buy: number | undefined;
    sell: number;
    avg: number;
}

export async function scrapeDolarBlue(startDate?: string, endDate?: string): Promise<DollarDataPoint[]> {
    try {
        // Default to last 30 days if not specified
        const end = endDate || new Date().toISOString().split('T')[0];
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const url = `https://mercados.ambito.com//dolar/informal/historico-general/${start}/${end}`;

        console.log('Fetching Dolar Blue from:', url);

        const response = await fetch(url, {
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Ambito API returned ${response.status}`);
        }

        const textData = await response.text();
        let parsedData: any[] = [];

        try {
            parsedData = JSON.parse(textData);
        } catch {
            const match = textData.match(/\[\s*\[[\s\S]*?\]\s*\]/);
            if (match) {
                parsedData = JSON.parse(match[0]);
            } else {
                throw new Error('Cannot parse Ambito response format');
            }
        }

        if (!Array.isArray(parsedData)) {
            throw new Error('Parsed data is not an array');
        }

        const records: DollarDataPoint[] = [];

        for (const entry of parsedData) {
            try {
                let dateStr: string;
                let compra: number | undefined;
                let venta: number | undefined;

                if (Array.isArray(entry)) {
                    dateStr = entry[0];
                    if (entry.length === 3) {
                        compra = parseFloat(String(entry[1]).replace(',', '.'));
                        venta = parseFloat(String(entry[2]).replace(',', '.'));
                    } else if (entry.length === 2) {
                        venta = parseFloat(String(entry[1]).replace(',', '.'));
                    }
                } else {
                    continue;
                }

                // Parse DD-MM-YYYY
                const dateParts = dateStr.split(/[-/]/);
                if (dateParts.length !== 3) continue;

                // Ambito usually returns DD-MM-YYYY
                const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`);

                if (venta !== undefined && !isNaN(venta)) {
                    const avg = (compra !== undefined && !isNaN(compra)) ? (compra + venta) / 2 : venta;

                    records.push({
                        date,
                        buy: compra,
                        sell: venta,
                        avg
                    });
                }
            } catch (err) {
                console.error('Error parsing entry:', entry);
            }
        }

        return records;

    } catch (error) {
        console.error('Error scraping Dolar Blue:', error);
        throw error;
    }
}
