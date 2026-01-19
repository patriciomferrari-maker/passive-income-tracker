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

        // Click "Realizá tu pago o recarga sin registrarte" using JavaScript
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
            const payButton = buttons.find(btn => btn.textContent?.includes('sin registrarte'));
            if (payButton) (payButton as HTMLElement).click();
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Select "N° de cuenta" and click "Siguiente" using JavaScript
        await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('div[role="button"]'));
            const accountOption = options.find(opt => opt.textContent?.includes('N° de cuenta'));
            if (accountOption) {
                (accountOption as HTMLElement).click();
                setTimeout(() => {
                    const nextButton = Array.from(document.querySelectorAll('button'))
                        .find(btn => btn.textContent?.includes('Siguiente'));
                    if (nextButton) (nextButton as HTMLElement).click();
                }, 500);
            }
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Enter account number
        const inputSelector = 'input[data-testid="procedimiento_de_pago.accountIdentifierInput.clientNumber.input"]';
        await page.waitForSelector(inputSelector, { timeout: 10000 });
        await page.type(inputSelector, accountNumber);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Click "Siguiente" to submit account number
        await page.evaluate(() => {
            const nextButton = Array.from(document.querySelectorAll('button'))
                .find(btn => btn.textContent?.includes('Siguiente'));
            if (nextButton) (nextButton as HTMLElement).click();
        });

        // Wait for address confirmation
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Click "Siguiente" to confirm address
        await page.evaluate(() => {
            const nextButton = Array.from(document.querySelectorAll('button'))
                .find(btn => btn.textContent?.includes('Siguiente'));
            if (nextButton) (nextButton as HTMLElement).click();
        });

        // Wait for balance page to load
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Extract both Saldo Total and Factura Actual
        const balanceData = await page.evaluate(() => {
            const h4Elements = Array.from(document.querySelectorAll('h4'));

            // Find Saldo Total
            const saldoH4 = h4Elements.find(el => el.textContent?.includes('Saldo Total'));
            let saldoTotal = '';
            if (saldoH4) {
                const parent = saldoH4.closest('div');
                const h2 = parent?.querySelector('h2');
                const decimalsDiv = h2?.nextElementSibling;
                saldoTotal = (h2?.textContent?.trim() || '') + (decimalsDiv?.textContent?.trim() || '');
            }

            // Find Factura Actual
            const facturaH4 = h4Elements.find(el => el.textContent?.includes('Factura Actual'));
            let facturaActual = '';
            if (facturaH4) {
                const parent = facturaH4.closest('div');
                const h2 = parent?.querySelector('h2');
                const decimalsDiv = h2?.nextElementSibling;
                facturaActual = (h2?.textContent?.trim() || '') + (decimalsDiv?.textContent?.trim() || '');
            }

            return {
                saldoTotal,
                facturaActual
            };
        });

        console.log(`[Edenor] Balance data:`, balanceData);

        // Parse amounts
        const parseCurrency = (text: string): number => {
            if (!text) return 0;
            // Remove $ and spaces
            const cleanText = text.replace(/\$/g, '').replace(/\s/g, '');
            // Argentine format: 22.792,99 (dots for thousands, comma for decimals)
            // Remove thousand separators (dots) and replace decimal comma with dot
            const normalized = cleanText.replace(/\./g, '').replace(',', '.');
            const amount = parseFloat(normalized);
            return isNaN(amount) ? 0 : amount;
        };

        const saldoTotal = parseCurrency(balanceData.saldoTotal);
        const facturaActual = parseCurrency(balanceData.facturaActual);

        // If Saldo Total = Factura Actual, no overdue debt (only current bill)
        const hasOverdueDebt = saldoTotal > facturaActual;
        const debtAmount = hasOverdueDebt ? (saldoTotal - facturaActual) : 0;

        console.log(`[Edenor] Saldo Total: $${saldoTotal}, Factura Actual: $${facturaActual}, Overdue: ${hasOverdueDebt}`);

        const result: EdenorResult = {
            status: hasOverdueDebt ? 'OVERDUE' : 'UP_TO_DATE',
            debtAmount: debtAmount,
            lastBillAmount: facturaActual > 0 ? facturaActual : null,
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
