
// @ts-nocheck
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';

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

// User provided barcode
const BARCODE_ID = '32910271685513524055282506027012600015596344';

async function checkNaturgyRapipago(barcode: string): Promise<NaturgyRapipagoResult> {
    console.log(`🔥 [Naturgy Rapipago] Checking Barcode: ${barcode}`);

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
        console.log('[Naturgy Rapipago] Navigating to Rapipago...');
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('[Naturgy Rapipago] Page loaded. Starting human behavior...');

        // 2. Human Behavior
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        await page.mouse.move(Math.random() * 500, Math.random() * 500, { steps: 20 });

        // 3. Location (Try BUENOS AIRES)
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
                await page.keyboard.type(char, { delay: 150 + Math.random() * 100 });
            }
            await new Promise(r => setTimeout(r, 2000));

            // Try to be more specific if possible, but usually NATURGY BAN is the main one.
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        console.log('[Naturgy Rapipago] Company selected');
        await new Promise(r => setTimeout(r, 3000)); // Wait for services to load

        // 6. Select Service Option "COBRANZA CON CODIGO DE BARRA"
        console.log('[Naturgy Rapipago] Checking for "COBRANZA CON CODIGO DE BARRA"...');

        const selectionResult = await page.evaluate(() => {
            const textToFind = 'CODIGO DE BARRA'; // Loosened match slightly just in case
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));

            const targetInput = inputs.find(input => {
                // Check sibling labels (React structures often put label next to input)
                const parentSibling = input.parentElement?.nextElementSibling;
                if (parentSibling && parentSibling.textContent?.toUpperCase().includes(textToFind)) return true;

                // Check parent chain
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

            // Fallback: search for the text element itself and click it
            const allElements = Array.from(document.querySelectorAll('*'));
            const textEl = allElements.find(el =>
                el.children.length === 0 &&
                el.textContent?.toUpperCase().includes(textToFind)
            );
            if (textEl) {
                (textEl as HTMLElement).click();
                return { found: true, fallback: true };
            }

            return { found: false };
        });

        if (selectionResult.found) {
            console.log('[Naturgy Rapipago] ✅ Found and clicked "Código de Barra" option');
            if (selectionResult.x) {
                await page.mouse.move(selectionResult.x, selectionResult.y, { steps: 10 });
            }
        } else {
            console.log('[Naturgy Rapipago] ⚠️ Specific service text not found. Trying to select *any* available radio...');
            // Fallback to first radio if specific one not found (user might be right about the name, but maybe exact casing/spacing differs)
            const anyclicked = await page.evaluate(() => {
                const r = document.querySelector('input[type="radio"]');
                if (r) { (r as HTMLElement).click(); return true; }
                return false;
            });
            if (anyclicked) console.log('[Naturgy Rapipago] Clicked first available radio as fallback.');
        }

        await new Promise(r => setTimeout(r, 2000));

        // 7. Input Barcode Logic with "Continuar" check
        console.log('[Naturgy Rapipago] ✍️ Looking for input field...');

        // Selector adjusted for potentially different placeholder for barcode
        const inputSelector = 'input[placeholder*="barra" i], input[placeholder*="código" i], input[placeholder*="cliente" i]';
        let inputClient = await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 }).catch(() => null);

        if (!inputClient) {
            console.log('[Naturgy Rapipago] ⚠️ Input not found immediately. Clicking Continuar to see if it appears on next screen...');
            const btnContinueService = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null);

            if (btnContinueService) {
                await btnContinueService.click();
                console.log('[Naturgy Rapipago] Clicked Continuar. Waiting...');
                await new Promise(r => setTimeout(r, 3000));

                // Try finding input again - expanded search
                inputClient = await page.waitForSelector('input:not([type="checkbox"]):not([type="radio"])', { visible: true, timeout: 10000 }).catch(() => null);
            }
        }

        if (inputClient) {
            console.log('[Naturgy Rapipago] Found input field. Typing barcode...');
            await inputClient.click();
            await page.evaluate((el) => (el as HTMLInputElement).value = '', inputClient);
            await new Promise(r => setTimeout(r, 500));
            await inputClient.type(barcode, { delay: 100 }); // Type faster for long barcode
            await page.mouse.move(100, 100);
            await page.evaluate((el) => {
                el.blur();
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, inputClient);
            await new Promise(r => setTimeout(r, 1500));
        } else {
            console.log('❌ Input NOT found even after navigation.');
            await page.screenshot({ path: 'scripts/naturgy-barcode-failed.png' });
            const html = await page.content();
            fs.writeFileSync('scripts/naturgy-barcode-failed.html', html);

            // Dump visible inputs one last time
            const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({ p: i.placeholder, t: i.type, v: i.offsetParent !== null })));
            console.log('Visible inputs:', JSON.stringify(inputs));

            throw new Error('Barcode input not found');
        }

        // 8. Continue (Final Submission)
        console.log('[Naturgy Rapipago] Submitting...');
        const btnContinuar = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null) as any;

        if (btnContinuar) {
            await btnContinuar.click();
        } else {
            await page.keyboard.press('Enter');
        }

        // 9. Read Results
        console.log('[Naturgy Rapipago] Waiting for results...');
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

        console.log('Final Result:', result);

        await browser.close();
        return result;

    } catch (error: any) {
        console.error('Error:', error);
        if (browser) await browser.close();
        return { error: error.message };
    }
}

checkNaturgyRapipago(BARCODE_ID).then(res => console.log('FINAL:', res));
