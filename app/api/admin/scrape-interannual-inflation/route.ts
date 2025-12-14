import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

interface ScrapedData {
    date: Date;
    mensual: number;
    interanual: number;
}

async function scrapeYear(year: number): Promise<ScrapedData[]> {
    const url = `https://datosmacro.expansion.com/ipc-paises/argentina?sector=IPC+General&sc=IPC-IG&anio=${year}`;

    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        const data: ScrapedData[] = [];

        // Find the table with inflation data
        $('table.tabla tr').each((index, element) => {
            if (index === 0) return; // Skip header row

            const cells = $(element).find('td');
            if (cells.length < 3) return;

            // Extract date (format: "Noviembre 2025" or similar)
            const dateText = $(cells[0]).text().trim();

            // Extract mensual (monthly variation)
            const mensualText = $(cells[1]).text().trim().replace('%', '').replace(',', '.');
            const mensual = parseFloat(mensualText);

            // Extract interanual (year-over-year variation)
            const interanualText = $(cells[2]).text().trim().replace('%', '').replace(',', '.');
            const interanual = parseFloat(interanualText);

            // Parse date
            const monthNames: { [key: string]: number } = {
                'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
                'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
                'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
            };

            const parts = dateText.toLowerCase().split(' ');
            if (parts.length === 2) {
                const monthName = parts[0];
                const yearNum = parseInt(parts[1]);
                const monthNum = monthNames[monthName];

                if (monthNum !== undefined && !isNaN(yearNum) && !isNaN(mensual) && !isNaN(interanual)) {
                    const date = new Date(yearNum, monthNum, 1, 12, 0, 0, 0); // Noon UTC
                    data.push({ date, mensual, interanual });
                }
            }
        });

        return data;
    } catch (error) {
        console.error(`Error scraping year ${year}:`, error);
        return [];
    }
}

export async function POST() {
    try {
        const currentYear = new Date().getFullYear();
        const startYear = 2019;

        let totalUpdated = 0;
        let totalCreated = 0;

        // Scrape data for each year from 2019 to current year
        for (let year = startYear; year <= currentYear; year++) {
            console.log(`Scraping year ${year}...`);
            const yearData = await scrapeYear(year);

            // Update database with scraped data
            for (const item of yearData) {
                const result = await prisma.economicIndicator.upsert({
                    where: {
                        type_date: {
                            type: 'IPC',
                            date: item.date
                        }
                    },
                    update: {
                        value: item.mensual,
                        interannualValue: item.interanual
                    },
                    create: {
                        type: 'IPC',
                        date: item.date,
                        value: item.mensual,
                        interannualValue: item.interanual
                    }
                });

                if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                    totalCreated++;
                } else {
                    totalUpdated++;
                }
            }

            // Small delay between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return NextResponse.json({
            success: true,
            message: `Scraping completed. Created: ${totalCreated}, Updated: ${totalUpdated}`,
            yearsScraped: currentYear - startYear + 1
        });
    } catch (error) {
        console.error('Error in scraping endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to scrape inflation data' },
            { status: 500 }
        );
    }
}
