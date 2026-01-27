
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export interface NaturgyRapipagoResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkNaturgyRapipago(barcode: string): Promise<NaturgyRapipagoResult> {
    console.log(`🔥 [Naturgy Rapipago] Checking Barcode: ${barcode}`);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true, // Headless for production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        }) as unknown as Browser;

        page = await browser.newPage();

        // 1. Navigate to Rapipago
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // 2. Human Behavior Emulation
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        await page.mouse.move(Math.random() * 500, Math.random() * 500, { steps: 20 });

        // 3. Select Location (BUENOS AIRES for Provincia)
        const inputLoc = await page.waitForSelector('input', { visible: true });
        if (inputLoc) {
            await inputLoc.click();
            await new Promise(r => setTimeout(r, 500));
            for (const char of 'BUENOS AIRES') {
                await page.keyboard.type(char, { delay: 100 + Math.random() * 150 });
            }
            await new Promise(r => setTimeout(r, 1000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 2000));

        // 4. Click "Pago de Facturas"
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const pagoFacturas = (elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas') as HTMLElement);
            if (pagoFacturas) pagoFacturas.click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // 5. Search for Company "NATURGY"
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
        if (companyInput) {
            await companyInput.click();
            await new Promise(r => setTimeout(r, 400));
            for (const char of 'NATURGY') {
                await page.keyboard.type(char, { delay: 150 });
            }
            await new Promise(r => setTimeout(r, 2000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 3000));

        // 6. Select Service "COBRANZA CON CODIGO DE BARRA"
        const selectionResult = await page.evaluate(() => {
            const textToFind = 'CODIGO DE BARRA';
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));

            const targetInput = inputs.find(input => {
                const parentSibling = input.parentElement?.nextElementSibling;
                if (parentSibling && parentSibling.textContent?.toUpperCase().includes(textToFind)) return true;

                let parent = input.parentElement;
                while (parent && parent.tagName !== 'LI' && parent.tagName !== 'BODY') {
                    if (parent.innerText && parent.innerText.toUpperCase().includes(textToFind)) return true;
                    parent = parent.parentElement;
                }
                return false;
            });

            if (targetInput) {
                const rect = (targetInput as HTMLElement).getBoundingClientRect();
                (targetInput as HTMLElement).click();
                return { found: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
            return { found: false };
        });

        if (selectionResult.found && selectionResult.x) {
            await page.mouse.move(selectionResult.x, selectionResult.y, { steps: 10 });
        }

        await new Promise(r => setTimeout(r, 2000));

        // 7. Input Barcode
        const inputSelector = 'input[placeholder*="barra" i], input[placeholder*="código" i], input[placeholder*="cliente" i]';
        let inputClient = await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 }).catch(() => null);

        if (!inputClient) {
            // Try clicking Continuar to advance
            const btnContinueService = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null);
            if (btnContinueService) {
                await btnContinueService.click();
                await new Promise(r => setTimeout(r, 3000));
                inputClient = await page.waitForSelector('input:not([type="checkbox"]):not([type="radio"])', { visible: true, timeout: 10000 }).catch(() => null);
            }
        }

        if (inputClient) {
            await inputClient.click();
            await page.evaluate((el) => (el as HTMLInputElement).value = '', inputClient);
            await new Promise(r => setTimeout(r, 500));
            await inputClient.type(barcode, { delay: 100 });
            await page.mouse.move(100, 100);
            await page.evaluate((el) => {
                el.blur();
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, inputClient);
            await new Promise(r => setTimeout(r, 1500));
        } else {
            throw new Error('Barcode input not found');
        }

        // 8. Submit
        const btnContinuar = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null) as any;
        if (btnContinuar) {
            await btnContinuar.click();
        } else {
            await page.keyboard.press('Enter');
        }

        // 9. Read Results
        await new Promise(r => setTimeout(r, 8000));

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();

            const errorContainer = document.querySelector('.invoice-validation-error-container');
            if (errorContainer) return { error: document.querySelector('.invoice-validation-error-description')?.textContent?.trim() };

            const noDebt = ['no registra deuda', 'sin deuda', 'saldo cancelado'].some(t => lowerBody.includes(t));

            // Naturgy-specific parsing: Look for "A pagar" or "Importe" fields
            let totalAmount = 0;

            // Try to find "A pagar" amount (most reliable)
            const aPagarMatch = bodyText.match(/A\s+pagar\s+([\d,.]+)/i);
            if (aPagarMatch) {
                let clean = aPagarMatch[1].trim();
                if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                else if (clean.includes(',')) clean = clean.replace(',', '.');
                totalAmount = parseFloat(clean) || 0;
            } else {
                // Fallback: Try "Importe"
                const importeMatch = bodyText.match(/Importe\s+([\d,.]+)/i);
                if (importeMatch) {
                    let clean = importeMatch[1].trim();
                    if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                    else if (clean.includes(',')) clean = clean.replace(',', '.');
                    totalAmount = parseFloat(clean) || 0;
                }
            }

            return { noDebt, totalAmount };
        });

        let finalResult: NaturgyRapipagoResult;
        if ((result as any).error) {
            finalResult = { status: 'ERROR', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: (result as any).error };
        } else if ((result as any).totalAmount > 0) {
            finalResult = { status: 'OVERDUE', debtAmount: (result as any).totalAmount, lastBillAmount: null, lastBillDate: null, dueDate: null };
        } else {
            finalResult = { status: 'UP_TO_DATE', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null };
        }

        await browser.close();
        return finalResult;

    } catch (error: any) {
        if (browser) await browser.close();
        return { status: 'ERROR', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: error.message };
    }
}
