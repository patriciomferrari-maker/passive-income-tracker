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
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Metrogas portal
        await page.goto('https://saldos.micuenta.metrogas.com.ar/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Enter client number
        await page.waitForSelector('input[type="text"]', { timeout: 10000 });
        await page.type('input[type="text"]', clientNumber);

        // Click search button
        await page.click('button[type="button"]');

        // Wait for results
        await page.waitForTimeout(3000);

        // Check for debt status
        const pageContent = await page.content();
        const hasDebt = !pageContent.includes('No registra deuda');

        let result: MetrogasResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (pageContent.includes('No registra deuda')) {
            result.status = 'UP_TO_DATE';

            // Try to extract last bill amount
            try {
                const billText = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const billElement = elements.find(el =>
                        el.textContent?.includes('$') && el.textContent?.includes(',')
                    );
                    return billElement?.textContent || '';
                });

                const amountMatch = billText.match(/\$\s*([\d,.]+)/);
                if (amountMatch) {
                    result.lastBillAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
                }
            } catch (e) {
                console.log('[Metrogas] Could not extract bill amount');
            }
        } else if (hasDebt) {
            result.status = 'OVERDUE';
            // Try to extract debt amount
            try {
                const debtText = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const debtElement = elements.find(el =>
                        el.textContent?.toLowerCase().includes('deuda') && el.textContent?.includes('$')
                    );
                    return debtElement?.textContent || '';
                });

                const amountMatch = debtText.match(/\$\s*([\d,.]+)/);
                if (amountMatch) {
                    result.debtAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
                }
            } catch (e) {
                console.log('[Metrogas] Could not extract debt amount');
            }
        }

        console.log(`[Metrogas] Result:`, result);
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
