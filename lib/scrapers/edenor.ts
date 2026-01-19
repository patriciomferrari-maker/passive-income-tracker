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
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Edenor welcome page
        await page.goto('https://edenordigital.com/ingreso/bienvenida', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Click "Pago sin registrarse"
        await new Promise(resolve => setTimeout(resolve, 2000));
        const buttons = await page.$$('button');
        for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('sin registrarte')) {
                await button.click();
                break;
            }
        }

        // Wait and select "N° de cuenta"
        await new Promise(resolve => setTimeout(resolve, 2000));
        const options = await page.$$('div[role="button"]');
        for (const option of options) {
            const text = await page.evaluate(el => el.textContent, option);
            if (text?.includes('N° de cuenta')) {
                await option.click();
                break;
            }
        }

        // Click "Siguiente"
        await new Promise(resolve => setTimeout(resolve, 1000));
        const nextButtons = await page.$$('button');
        for (const button of nextButtons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('Siguiente')) {
                await button.click();
                break;
            }
        }

        // Enter account number
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.type('input[type="text"]', accountNumber);

        // Click "Siguiente" again
        await new Promise(resolve => setTimeout(resolve, 1000));
        const nextButtons2 = await page.$$('button');
        for (const button of nextButtons2) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('Siguiente')) {
                await button.click();
                break;
            }
        }

        // Wait for address confirmation and click "Siguiente"
        await new Promise(resolve => setTimeout(resolve, 2000));
        const nextButtons3 = await page.$$('button');
        for (const button of nextButtons3) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text?.includes('Siguiente')) {
                await button.click();
                break;
            }
        }

        // Wait for balance page
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract debt amount
        const pageContent = await page.content();
        let debtAmount = 0;

        try {
            const amountText = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('*'));
                const amountElement = elements.find(el =>
                    el.textContent?.includes('$') && el.textContent?.match(/\d/)
                );
                return amountElement?.textContent || '';
            });

            const amountMatch = amountText.match(/\$\s*([\d,.]+)/);
            if (amountMatch) {
                debtAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
            }
        } catch (e) {
            console.log('[Edenor] Could not extract amount');
        }

        const result: EdenorResult = {
            status: debtAmount > 0 ? 'OVERDUE' : 'UP_TO_DATE',
            debtAmount: debtAmount,
            lastBillAmount: debtAmount > 0 ? debtAmount : null,
            lastBillDate: null,
            dueDate: null
        };

        console.log(`[Edenor] Result:`, result);
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
