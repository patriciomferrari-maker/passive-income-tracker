import puppeteer from 'puppeteer';

export interface NaturgyResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkNaturgy(accountNumber: string): Promise<NaturgyResult> {
    let browser;

    try {
        console.log(`[Naturgy] Checking account: ${accountNumber}`);

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Naturgy payment page
        await page.goto('https://ov.naturgy.com.ar/Account/BotonDePago', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Enter account number (8 digits)
        const inputSelector = 'input#nro_cliente, input[type="text"]';
        await page.waitForSelector(inputSelector, { timeout: 10000 });
        await page.type(inputSelector, accountNumber);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click search/submit button
        await page.evaluate(() => {
            const submitBtn = document.querySelector('button#Consultar, button[type="submit"]');
            if (submitBtn) (submitBtn as HTMLElement).click();
        });

        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check for "no debt" message
        const noDebtMessage = await page.evaluate(() => {
            const bodyText = document.body.textContent || '';
            return bodyText.includes('no posee facturas pendientes') ||
                bodyText.includes('No se registran deudas') ||
                bodyText.includes('sin deuda');
        });

        if (noDebtMessage) {
            console.log('[Naturgy] ✅ No debt found');
            return {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        }

        // Extract debt information
        const debtInfo = await page.evaluate(() => {
            // Look for amount in table cells or spans
            const amountElements = Array.from(document.querySelectorAll('td, span, div'))
                .filter(el => el.textContent?.includes('$'));

            let totalAmount = '';
            if (amountElements.length > 0) {
                totalAmount = amountElements[0].textContent || '';
            }

            return { totalAmount };
        });

        console.log(`[Naturgy] Debt info:`, debtInfo);

        // Parse amount
        const parseCurrency = (text: string): number => {
            if (!text) return 0;
            const cleanText = text.replace(/\$/g, '').replace(/\s/g, '');
            const normalized = cleanText.replace(/\./g, '').replace(',', '.');
            const amount = parseFloat(normalized);
            return isNaN(amount) ? 0 : amount;
        };

        const debtAmount = parseCurrency(debtInfo.totalAmount);

        if (debtAmount > 0) {
            console.log(`[Naturgy] ⚠️  Debt found: $${debtAmount}`);
            return {
                status: 'OVERDUE',
                debtAmount: debtAmount,
                lastBillAmount: debtAmount,
                lastBillDate: null,
                dueDate: null
            };
        }

        console.log('[Naturgy] ℹ️  Unknown status');
        return {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

    } catch (error: any) {
        console.error('[Naturgy] Error:', error.message);
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
