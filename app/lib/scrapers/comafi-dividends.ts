import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export interface CedearDividendAnnouncement {
    ticker: string;
    companyName: string;
    announcementDate: Date;
    eventName: string;
    pdfUrl: string;
}

export async function scrapeComafiDividends(): Promise<CedearDividendAnnouncement[]> {
    console.log('🔄 [ComafiDividends] Starting scrape...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('🔄 [ComafiDividends] Navigating to page...');
        await page.goto('https://www.comafi.com.ar/custodiaglobal/dividendos.aspx', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('🔄 [ComafiDividends] Extracting data...');

        const dividends = await page.evaluate(() => {
            const results: any[] = [];

            // Find the table with dividend announcements
            const table = document.querySelector('table.tblEventos');
            if (!table) return results;

            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                try {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return;

                    // Column 0: Date (DD/MM/YY format)
                    const dateText = cells[0]?.textContent?.trim() || '';

                    // Column 1: Ticker (hidden but present)
                    const ticker = cells[1]?.querySelector('strong')?.textContent?.trim() || '';

                    // Column 2: Event name
                    const eventName = cells[2]?.textContent?.trim() || '';

                    // Column 4: PDF download link
                    const pdfLink = cells[4]?.querySelector('a')?.getAttribute('href') || '';

                    if (ticker && dateText && eventName) {
                        // Parse date from DD/MM/YY to Date object
                        const [day, month, year] = dateText.split('/');
                        const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
                        const parsedDate = new Date(`${fullYear}-${month}-${day}`);

                        // Extract company name from event name (remove "ANUNCIO DE DIVIDENDO " prefix)
                        const companyName = eventName.replace(/ANUNCIO DE DIVID?ENDO\s*/i, '').trim();

                        results.push({
                            ticker: ticker.trim(),
                            companyName: companyName || ticker,
                            announcementDate: parsedDate.toISOString(),
                            eventName,
                            pdfUrl: pdfLink.startsWith('http') ? pdfLink : `https://www.comafi.com.ar/custodiaglobal/${pdfLink}`
                        });
                    }
                } catch (e) {
                    console.error('Error parsing row:', e);
                }
            });

            return results;
        });

        console.log(`✅ [ComafiDividends] Found ${dividends.length} dividend announcements`);

        // Convert ISO strings back to Date objects
        return dividends.map(d => ({
            ...d,
            announcementDate: new Date(d.announcementDate)
        }));

    } catch (error) {
        console.error('❌ [ComafiDividends] Error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Helper to parse PDF and enrich data
async function parsePdfAndEnrich(announcement: CedearDividendAnnouncement): Promise<any> {
    // This function will be called by the consumer (Cron) or we can integrate it here if we want strict coupling.
    // For now, let's keep the scraper focused on "Finding Announcements".
    // The "Enrichment" logic is better suited in a separate service or distinct step 
    // to avoid bloated scraper function and handle PDF failures gracefully without stopping the scrape.
    return {};
}

/**
 * Extracts text from a PDF Buffer using pdf2json
 */
import PDFParser from 'pdf2json';
import axios from 'axios';

export async function extractDetailsFromPdf(pdfUrl: string) {
    console.log(`📄 [PDF Parser] Downloading ${pdfUrl}...`);
    try {
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        const pdfBuffer = response.data;

        const pdfParser = new PDFParser(this, 1);

        return new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                try {
                    // Extract text
                    const rawText = pdfParser.getRawTextContent().replace(/\r\n/g, " ");

                    // 1. Try to find Payment Date "Fecha de Pago"
                    // Regex: date (DD/MM/YYYY) close to "pago"
                    const dateMatch = rawText.match(/pago.*?(\d{2}\/\d{2}\/\d{4})/i);
                    const paymentDate = dateMatch ? dateMatch[1] : null;

                    // 2. Try to find Amount (USD/ARS)
                    // Look for "Monto bruto" or similar
                    const usdMatch = rawText.match(/USD\s*([\d,]+\.?\d*)/i);
                    const amountUSD = usdMatch ? parseFloat(usdMatch[1].replace(',', '.')) : null;

                    resolve({ paymentDate, amountUSD, rawText: rawText.substring(0, 500) + '...' });
                } catch (e) {
                    reject(e);
                }
            });

            pdfParser.parseBuffer(pdfBuffer);
        });
    } catch (e) {
        console.error(`[PDF Parser] Failed to parse ${pdfUrl}`, e);
        return null;
    }
}

// For testing
if (require.main === module) {
    scrapeComafiDividends()
        .then(dividends => {
            console.log('\n📊 Results:');
            dividends.forEach((d, idx) => {
                console.log(`\n${idx + 1}. ${d.ticker} - ${d.companyName}`);
                console.log(`   Date: ${d.announcementDate.toISOString().split('T')[0]}`);
                console.log(`   Event: ${d.eventName}`);
                console.log(`   PDF: ${d.pdfUrl}`);
            });
        })
        .catch(console.error);
}
