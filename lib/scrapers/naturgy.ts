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
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Naturgy public payment consultation page
        const url = 'https://ov.naturgy.com.ar/publico/pagos/consulta';
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait longer for React SPA to hydrate (10-20 seconds)
        console.log('[Naturgy] Waiting for React SPA to load...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Check for maintenance page
        const isMaintenancePage = await page.evaluate(() => {
            const bodyText = document.body.textContent || '';
            return bodyText.includes('estamos en mantenimiento') ||
                bodyText.includes('Ups') ||
                bodyText.includes('maintenance');
        });

        if (isMaintenancePage) {
            console.log('[Naturgy] ⚠️  Portal is under maintenance');
            return {
                status: 'UNKNOWN',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Portal en mantenimiento'
            };
        }

        // Look for the supply number input field (React Material UI)
        const inputSelector = 'input.MuiInputBase-input, input[name="suministro"]';

        try {
            await page.waitForSelector(inputSelector, { timeout: 10000 });
        } catch (error) {
            console.log('[Naturgy] ⚠️  Input field not found - portal may be loading or in maintenance');
            return {
                status: 'UNKNOWN',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Campo de entrada no encontrado'
            };
        }

        // Enter account number using React-compatible method
        await page.evaluate((selector, value) => {
            const input = document.querySelector(selector) as HTMLInputElement;
            if (input) {
                input.focus();
                input.value = value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            }
        }, inputSelector, accountNumber);

        console.log('[Naturgy] Account number entered');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click submit button (look for "Acceder a pagar" text)
        const buttonInfo = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const buttonTexts = buttons.map(btn => btn.textContent?.trim() || '');

            const submitButton = buttons.find(btn =>
                btn.textContent?.toLowerCase().includes('acceder') ||
                btn.textContent?.toLowerCase().includes('consultar') ||
                btn.textContent?.toLowerCase().includes('pagar')
            );

            return {
                found: !!submitButton,
                allButtons: buttonTexts,
                bodyPreview: document.body.textContent?.substring(0, 500) || ''
            };
        });

        console.log('[Naturgy] Debug - Buttons found:', buttonInfo.allButtons);
        console.log('[Naturgy] Debug - Body preview:', buttonInfo.bodyPreview.substring(0, 200));

        if (!buttonInfo.found) {
            console.log('[Naturgy] ⚠️  Submit button not found');
            return {
                status: 'UNKNOWN',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Botón de consulta no encontrado'
            };
        }

        // Click the button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitButton = buttons.find(btn =>
                btn.textContent?.toLowerCase().includes('acceder') ||
                btn.textContent?.toLowerCase().includes('consultar') ||
                btn.textContent?.toLowerCase().includes('pagar')
            );
            if (submitButton) {
                (submitButton as HTMLElement).click();
            }
        });

        console.log('[Naturgy] Waiting for results...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check for "no debt" message
        const noDebtMessage = await page.evaluate(() => {
            const bodyText = document.body.textContent || '';
            return bodyText.includes('no posee facturas pendientes') ||
                bodyText.includes('No se registran deudas') ||
                bodyText.includes('sin deuda') ||
                bodyText.includes('al día');
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

        // Extract debt information from results table
        const debtInfo = await page.evaluate(() => {
            // Look for "Importe" or "Total a pagar" in table
            const cells = Array.from(document.querySelectorAll('td, .MuiTableCell-root, span'));
            const amountCell = cells.find(cell => {
                const text = cell.textContent || '';
                return text.includes('$') && /\d/.test(text);
            });

            let totalAmount = '';
            if (amountCell) {
                totalAmount = amountCell.textContent || '';
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

        console.log('[Naturgy] ℹ️  Unknown status - no clear debt or no-debt message found');
        return {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: 'No se pudo determinar el estado'
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
