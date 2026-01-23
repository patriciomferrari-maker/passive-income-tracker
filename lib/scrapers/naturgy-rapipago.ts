
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

export async function checkNaturgyRapipago(onlinePaymentCode: string): Promise<NaturgyRapipagoResult> {
    console.log(`🏛️ [Naturgy Rapipago] Checking code: ${onlinePaymentCode}`);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: false,
            executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            userDataDir: 'C:\\temp\\EdgeProfile',
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        }) as unknown as Browser;

        page = await browser.newPage();

        // 1. Navigate directly to Rapipago payments section
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('[Naturgy Rapipago] Page loaded. Starting human behavior...');

        // Use 'CAPITAL FEDERAL'
        const inputLoc = await page.waitForSelector('input', { visible: true, timeout: 15000 });
        if (inputLoc) {
            await inputLoc.click();
            await new Promise(r => setTimeout(r, 500));
            for (const char of 'CAPITAL FEDERAL') {
                await page.keyboard.type(char, { delay: 50 + Math.random() * 50 });
            }
            await new Promise(r => setTimeout(r, 1500));
            await page.keyboard.press('ArrowDown');
            await new Promise(r => setTimeout(r, 500));
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 2000));

        // Click "Pago de Facturas"
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const pagoFacturas = (elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas') as HTMLElement);
            if (pagoFacturas) {
                pagoFacturas.click();
            }
        });

        await new Promise(r => setTimeout(r, 3000));

        // Search for company "Naturgy"
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
        if (companyInput) {
            await companyInput.click();
            await new Promise(r => setTimeout(r, 400));
            for (const char of 'Naturgy') {
                await page.keyboard.type(char, { delay: 100 });
            }
            await new Promise(r => setTimeout(r, 2500));

            // Select "Naturgy Buenos Aires"
            const option = await page.waitForSelector('::-p-text(Naturgy Buenos Aires)', { timeout: 8000 }).catch(() => null);

            if (option) {
                await option.click();
            } else {
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
            }
        }

        console.log('[Naturgy Rapipago] Company selected');
        await new Promise(r => setTimeout(r, 2000));

        // Select "COBRANZA CON CODIGO DE BARRA"
        console.log('[Naturgy Rapipago] selecting service option: Barcode (Ultra-resilient)...');
        await page.waitForFunction(() => document.body.innerText.includes('COBRANZA CON CODIGO DE BARRA'), { timeout: 20000 });

        // Wait for radio buttons to definitely be in the DOM
        await page.waitForSelector('input[type="radio"]', { timeout: 10000 });

        // Extremely aggressive selection
        await page.evaluate(() => {
            const radios = Array.from(document.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
            const labels = Array.from(document.querySelectorAll('label'));

            // Try everything: radio click, label click, checked property, dispatching events
            const targetRadio = radios.find((r, i) => i === 0 || r.parentElement?.innerText.includes('BARRA')) || radios[0];
            if (targetRadio) {
                targetRadio.checked = true;
                targetRadio.click();
                targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
                targetRadio.dispatchEvent(new Event('input', { bubbles: true }));

                const parentLabel = targetRadio.closest('label') || targetRadio.parentElement;
                if (parentLabel) (parentLabel as HTMLElement).click();
            }

            // Also try clicking ANY element that has the text
            const spans = Array.from(document.querySelectorAll('span, p, div, label'));
            const textMatch = spans.find(s => s.textContent?.includes('COBRANZA CON CODIGO DE BARRA')) as HTMLElement;
            if (textMatch) textMatch.click();
        });

        await new Promise(r => setTimeout(r, 1500));

        // Click intermediate "Continuar" - it should be enabled now
        console.log('[Naturgy Rapipago] Checking for Continuar button...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.textContent?.includes('Continuar')) as HTMLButtonElement;
            if (btn) {
                btn.disabled = false; // Just in case, force it
                btn.click();
            }
        });

        await new Promise(r => setTimeout(r, 4000));

        // Input Código de barras
        console.log('[Naturgy Rapipago] ✍️  Entering barcode sequence...');

        // Use a generic text input selector if specific ones fail
        const inputSelector = 'input[placeholder*="arra" i], input[type="text"], .payments_fields';
        const inputCode = await page.waitForSelector(inputSelector, {
            visible: true,
            timeout: 15000
        });

        if (inputCode) {
            await inputCode.click();
            await page.evaluate((sel) => {
                const el = (document.querySelectorAll(sel) as NodeListOf<HTMLInputElement>)[1] || document.querySelector(sel);
                if (el) (el as HTMLInputElement).value = '';
            }, inputSelector);

            await new Promise(r => setTimeout(r, 500));
            await inputCode.type(onlinePaymentCode, { delay: 20 });

            await page.evaluate((sel) => {
                const els = Array.from(document.querySelectorAll(sel)) as HTMLInputElement[];
                const el = els.find(e => e.value === '') || els[els.length - 1];
                if (el) {
                    el.blur();
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, inputSelector);

            await new Promise(r => setTimeout(r, 2000));
        } else {
            throw new Error('Barcode input not found');
        }

        // Final Continuar
        console.log('[Naturgy Rapipago] Clicking final Continuar...');
        const finalClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.textContent?.includes('Continuar') && !(b as HTMLButtonElement).disabled) as HTMLElement;
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });

        if (!finalClicked) {
            await page.keyboard.press('Enter');
        }

        // Wait for results
        console.log('[Naturgy Rapipago] Waiting for results (long timeout)...');
        await new Promise(r => setTimeout(r, 15000));

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();

            if (lowerBody.includes('error') || document.querySelector('.invoice-validation-error-container')) {
                const desc = document.querySelector('.invoice-validation-error-description')?.textContent?.trim() || 'Generic error or validation failed';
                return { error: desc };
            }

            const noDebt = lowerBody.includes('no registra deuda') || lowerBody.includes('sin deuda');

            let totalAmount = 0;
            const amountMatch = bodyText.match(/(?:Importe|A pagar)\s*\$?\s*([\d,.]+)/i);
            if (amountMatch) {
                let clean = amountMatch[1].trim();
                if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                else if (clean.includes(',')) clean = clean.replace(',', '.');
                totalAmount = parseFloat(clean) || 0;
            } else {
                const amountMatches = bodyText.match(/\$\s*([\d,.]+)/g);
                if (amountMatches) {
                    const parsed = amountMatches.map(str => {
                        let clean = str.replace('$', '').trim();
                        if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                        else if (clean.includes(',')) clean = clean.replace(',', '.');
                        return parseFloat(clean) || 0;
                    });
                    totalAmount = Math.max(...parsed);
                }
            }

            return { noDebt, totalAmount };
        });

        console.log(`[Naturgy Rapipago] Final Logic Result:`, result);

        let finalResult: NaturgyRapipagoResult;
        if ((result as any).error) {
            finalResult = { status: 'ERROR', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: (result as any).error };
        } else if ((result as any).totalAmount > 0) {
            finalResult = { status: 'OVERDUE', debtAmount: (result as any).totalAmount, lastBillAmount: null, lastBillDate: null, dueDate: null };
        } else if ((result as any).noDebt) {
            finalResult = { status: 'UP_TO_DATE', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null };
        } else {
            finalResult = { status: 'UNKNOWN', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: 'Could not determine status from screen' };
        }

        await browser.close();
        return finalResult;

    } catch (error: any) {
        console.error('[Naturgy Rapipago] ❌ Error:', error.message);
        if (page) {
            await page.screenshot({ path: 'C:\\Users\\patri\\.gemini\\antigravity\\brain\\d81054cb-d81b-4896-a008-38772a5dd88e\\naturgy_error_standalone.png' });
        }
        if (browser) await browser.close();
        return { status: 'ERROR', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: error.message };
    }
}
