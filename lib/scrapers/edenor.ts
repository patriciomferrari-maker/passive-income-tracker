import puppeteer from 'puppeteer';

export interface EdenorResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkEdenor(accountNumber: string): Promise<EdenorResult> {
    let browser;

    try {
        console.log(`[Edenor] Checking account: ${accountNumber}`);

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Edenor welcome page
        await page.goto('https://edenordigital.com/ingreso/bienvenida', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Click "Realizá tu pago o recarga sin registrarte"
        await page.waitForSelector('text/sin registrarte', { timeout: 10000 });
        const payButtons = await page.$$('a, button');
        for (const button of payButtons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('sin registrarte')) {
                await button.click();
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Select "N° de cuenta"
        const accountOptions = await page.$$('div[role="button"], button');
        for (const option of accountOptions) {
            const text = await page.evaluate(el => el.textContent, option);
            if (text?.includes('N° de cuenta')) {
                await option.click();
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click "Siguiente"
        const nextButtons1 = await page.$$('button');
        for (const button of nextButtons1) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('Siguiente')) {
                await button.click();
                break;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enter account number
        await page.waitForSelector('input[type="text"]', { timeout: 10000 });
        await page.type('input[type="text"]', accountNumber);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click "Siguiente" again
        const nextButtons2 = await page.$$('button');
        for (const button of nextButtons2) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('Siguiente')) {
                await button.click();
                break;
            }
        }

        // Wait for address confirmation
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Click "Siguiente" to confirm address
        const nextButtons3 = await page.$$('button');
        for (const button of nextButtons3) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('Siguiente')) {
                await button.click();
                break;
            }
        }

        // Wait for balance page to load
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Extract balance from h2 and adjacent div
        const balanceData = await page.evaluate(() => {
            // Look for "Saldo Total" h4
            const h4Elements = Array.from(document.querySelectorAll('h4'));
            const saldoH4 = h4Elements.find(el => el.textContent?.includes('Saldo Total'));

            if (!saldoH4) return null;

            // Find the h2 with the main amount
            const parent = saldoH4.closest('div');
            const h2 = parent?.querySelector('h2');
            const decimalsDiv = h2?.nextElementSibling;

            const mainAmount = h2?.textContent?.trim() || '';
            const decimals = decimalsDiv?.textContent?.trim() || '';

            return {
                mainAmount,
                decimals,
                fullText: mainAmount + decimals
            };
        });

        console.log(`[Edenor] Balance data:`, balanceData);

        let debtAmount = 0;

        if (balanceData && balanceData.fullText) {
            // Parse amount like "$22.792,99" or "$ 22.792 99"
            const cleanText = balanceData.fullText.replace(/\$/g, '').replace(/\s/g, '');
            const amountMatch = cleanText.match(/([\d.]+),?(\d{2})?/);

            if (amountMatch) {
                const integerPart = amountMatch[1].replace(/\./g, ''); // Remove thousand separators
                const decimalPart = amountMatch[2] || '00';
                debtAmount = parseFloat(`${integerPart}.${decimalPart}`);
            }
        }

        const result: EdenorResult = {
            status: debtAmount > 0 ? 'OVERDUE' : 'UP_TO_DATE',
            debtAmount: debtAmount,
            lastBillAmount: debtAmount > 0 ? debtAmount : null,
            lastBillDate: null,
            dueDate: null
        };

        console.log(`[Edenor] Result: ${result.status}, Amount: $${result.debtAmount}`);
        return result;

    } catch (error: any) {
        console.error('[Edenor] Error:', error.message);
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
