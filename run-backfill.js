
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function scrapeDolarBlue(startDate, endDate) {
    try {
        const url = `https://mercados.ambito.com//dolar/informal/historico-general/${startDate}/${endDate}`;
        console.log('Fetching Dolar Blue from:', url);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const textData = await response.text();
        let parsedData = [];
        try {
            parsedData = JSON.parse(textData);
        } catch {
            const match = textData.match(/\[\s*\[[\s\S]*?\]\s*\]/);
            if (match) parsedData = JSON.parse(match[0]);
        }

        if (!Array.isArray(parsedData)) return [];

        const records = [];
        for (const entry of parsedData) {
            // [ '10-12-2025', '1.140,00', '1.170,00' ]
            if (!Array.isArray(entry)) continue;

            const dateStr = entry[0];
            let compra, venta;

            if (entry.length === 3) {
                compra = parseFloat(String(entry[1]).replace(',', '.'));
                venta = parseFloat(String(entry[2]).replace(',', '.'));
            } else if (entry.length === 2) {
                venta = parseFloat(String(entry[1]).replace(',', '.'));
            }

            const parts = dateStr.split(/[-/]/); // DD-MM-YYYY
            if (parts.length !== 3) continue;
            // 10-12-2025 -> 2025-12-10T12:00:00Z
            const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);

            if (venta !== undefined && !isNaN(venta)) {
                const avg = (compra !== undefined && !isNaN(compra)) ? (compra + venta) / 2 : venta;
                records.push({ date, buy: compra, sell: venta, avg });
            }
        }
        return records;
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function main() {
    const start = '01-01-2019';
    const end = new Date().toISOString().split('T')[0].split('-').reverse().join('-'); // DD-MM-YYYY

    // Ambito URL Format for END date: YYYY-MM-DD? No, scraping logic says URL uses start/end directly.
    // In `dolar.ts`: `historico-general/${start}/${end}`.
    // `start` default was ISO string (YYYY-MM-DD). 
    // Ambito takes `DD-MM-YYYY`.
    // Wait. `app/lib/scrapers/dolar.ts`:
    // const start = startDate || new Date(...).toISOString().split('T')[0];
    // `toISOString` produces `YYYY-MM-DD`.
    // Does Ambito accept YYYY-MM-DD?
    // Let's assume the existing code (which worked?) used YYYY-MM-DD.
    // If I used YYYY-MM-DD in the URL, does it work?
    // Let's try `2019-01-01` (YYYY-MM-DD).

    // But `end` needs same format.
    const endIso = new Date().toISOString().split('T')[0];

    console.log(`Scraping from ${start} to ${endIso}...`);
    const data = await scrapeDolarBlue(start, endIso); // Using standard format from scraped code

    console.log(`Found ${data.length} records. saving...`);

    let count = 0;
    for (const item of data) {
        const dayStart = new Date(item.date);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(item.date);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const existing = await prisma.economicIndicator.findFirst({
            where: {
                type: 'TC_USD_ARS',
                date: { gte: dayStart, lte: dayEnd }
            }
        });

        if (existing) {
            // Do NOT update date to avoid unique constraint collisions if multiple entries per day exist
            await prisma.economicIndicator.update({
                where: { id: existing.id },
                data: { value: item.avg, buyRate: item.buy, sellRate: item.sell }
            });
        } else {
            // Check if exact date exists before creating
            const exact = await prisma.economicIndicator.findFirst({
                where: { type: 'TC_USD_ARS', date: item.date }
            });
            if (!exact) {
                await prisma.economicIndicator.create({
                    data: { type: 'TC_USD_ARS', date: item.date, value: item.avg, buyRate: item.buy, sellRate: item.sell }
                });
            }
        }
        count++;
        if (count % 100 === 0) process.stdout.write('.');
    }
    console.log(`\nDone. Processed ${count} records.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
