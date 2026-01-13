
import * as cheerio from 'cheerio';
// Direct import to avoid local path issues
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Copy of types and helpers
interface BCRAData {
    type: string;
    date: Date;
    value: number;
    interannualValue?: number;
}

function parseArgentineNumber(str: string): number {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function parseBCRADate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function extractBCRAValue($: cheerio.CheerioAPI, serieId: string): { date: string; value: string } | null {
    const row = $(`a[href*="serie=${serieId}"]`).closest('tr');
    if (!row.length) return null;

    const cells = row.find('td');
    if (cells.length < 3) return null;

    const date = $(cells[1]).text().trim();
    const value = $(cells[2]).text().trim();

    return { date, value };
}

async function scrapeBCRA(): Promise<BCRAData[]> {
    const url = 'https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp';
    const originalTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const results: BCRAData[] = [];

        // 1. IPC Mensual (Serie 7931)
        const ipcMensual = extractBCRAValue($, '7931');
        if (ipcMensual) {
            const date = parseBCRADate(ipcMensual.date);
            const value = parseArgentineNumber(ipcMensual.value);
            results.push({ type: 'IPC', date, value });
        }

        // 2. IPC Interanual (Serie 7932)
        const ipcInteranual = extractBCRAValue($, '7932');
        if (ipcInteranual && ipcMensual) {
            const date = parseBCRADate(ipcInteranual.date);
            const interannualValue = parseArgentineNumber(ipcInteranual.value);
            const existing = results.find(r => r.type === 'IPC' && r.date.getTime() === date.getTime());
            if (existing) {
                existing.interannualValue = interannualValue;
            } else {
                results.push({ type: 'IPC', date, value: 0, interannualValue });
            }
        }

        // 3. UVA
        const uva = extractBCRAValue($, '7913');
        if (uva) {
            const date = parseBCRADate(uva.date);
            const value = parseArgentineNumber(uva.value);
            results.push({ type: 'UVA', date, value });
        }

        // 4. TC Oficial (Serie 7927)
        const tcOficial = extractBCRAValue($, '7927');
        if (tcOficial) {
            const date = parseBCRADate(tcOficial.date);
            const value = parseArgentineNumber(tcOficial.value);
            results.push({ type: 'TC_OFICIAL', date, value });
        }

        return results;
    } finally {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTLS;
    }
}

async function main() {
    console.log('🚀 Starting Standalone BCRA Update...');
    try {
        const data = await scrapeBCRA();
        console.log(`✅ Scraped ${data.length} items.`);

        for (const item of data) {
            console.log(`Processing ${item.type} (${item.date.toISOString().split('T')[0]})...`);
            const existing = await prisma.economicIndicator.findUnique({
                where: { type_date: { type: item.type, date: item.date } }
            });

            if (existing) {
                const needsUpdate =
                    existing.value !== item.value ||
                    (item.interannualValue !== undefined && existing.interannualValue !== item.interannualValue);

                if (needsUpdate) {
                    await prisma.economicIndicator.update({
                        where: { id: existing.id },
                        data: {
                            value: item.value,
                            ...(item.interannualValue !== undefined && { interannualValue: item.interannualValue })
                        }
                    });
                    console.log('  -> Updated');
                } else {
                    console.log('  -> Skipped (No changes)');
                }
            } else {
                await prisma.economicIndicator.create({
                    data: {
                        type: item.type,
                        date: item.date,
                        value: item.value,
                        interannualValue: item.interannualValue
                    }
                });
                console.log('  -> Created');
            }
        }
    } catch (e) {
        console.error('Failure:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
