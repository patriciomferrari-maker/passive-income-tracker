import puppeteer from 'puppeteer';

export interface MetrogasResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkMetrogas(clientNumber: string): Promise<MetrogasResult> {
    let browser;

    try {
        console.log(`[Metrogas] Checking account: ${clientNumber}`);

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Metrogas portal
        await page.goto('https://saldos.micuenta.metrogas.com.ar/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enter client number
        await page.waitForSelector('input', { timeout: 10000 });
        await page.type('input', clientNumber);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check for "No registra deuda" text
        const statusText = await page.evaluate(() => {
            // Look for the specific span with class sapMObjectNumberText
            const statusSpan = document.querySelector('.sapMObjectNumberText');
            return statusSpan?.textContent?.trim() || '';
        });

        console.log(`[Metrogas] Status text found: "${statusText}"`);

        let result: MetrogasResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (statusText.includes('No registra deuda')) {
            result.status = 'UP_TO_DATE';
            result.debtAmount = 0;
            console.log(`[Metrogas] ✅ No debt found`);
        } else if (statusText.match(/\$\s*[\d,.]+/)) {
            // Has a dollar amount - means there's debt
            result.status = 'OVERDUE';
            const amountMatch = statusText.match(/\$\s*([\d,.]+)/);
            if (amountMatch) {
                result.debtAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
            }
            console.log(`[Metrogas] ⚠️ Debt found: $${result.debtAmount}`);
        } else {
            console.log(`[Metrogas] ❓ Unknown status: "${statusText}"`);
        }

        return result;

    } catch (error: any) {
        console.error('[Metrogas] Error:', error.message);
        return {
            status: 'ERROR',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: error.message
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
