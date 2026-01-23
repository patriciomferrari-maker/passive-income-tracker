
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export interface ABLRapipagoResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkABLRapipago(partida: string): Promise<ABLRapipagoResult> {
    console.log(`🏛️ [ABL Rapipago] Checking partida: ${partida}`);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: false, // Keep visible for reliability
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        }) as unknown as Browser;

        page = await browser.newPage();

        // 1. Navigate directly to Rapipago payments section
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('[ABL Rapipago] Page loaded, looking for search input...');

        // Use 'CAPITAL FEDERAL' as per manual inspection
        const inputLoc = await page.waitForSelector('input', { visible: true });
        if (inputLoc) {
            await inputLoc.type('CAPITAL FEDERAL', { delay: 100 });
            await new Promise(r => setTimeout(r, 1000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 2000));

        // Click "Pago de Facturas"
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const pagoFacturas = elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas');
            if (pagoFacturas) (pagoFacturas as HTMLElement).click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // Search for company
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
        if (companyInput) {
            await companyInput.click();
            await companyInput.type('AGIP'); // User suggested AGIP
            await new Promise(r => setTimeout(r, 2000));

            // Select "AGIP GCBA - ABL IIBB PATENTES"
            const option = await page.waitForSelector('::-p-text(AGIP GCBA - ABL IIBB PATENTES)', { timeout: 5000 }).catch(() => null);

            if (option) {
                await option.click();
            } else {
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
            }
        }

        console.log('[ABL Rapipago] Company selected');
        console.log('[ABL Rapipago] Waiting for service options...');

        await page.waitForFunction(() => document.body.innerText.includes('COBRANZA SIN FACTURA'), { timeout: 20000 });

        // Select Service Option logic - INPUT SEARCH (Proven to reveal Partida input)
        console.log('[ABL Rapipago] searching for service option (Input Search)...');

        const selectionResult = await page.evaluate(() => {
            const textToFind = 'COBRANZA SIN FACTURA';
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));

            const targetInput = inputs.find(input => {
                const parentSibling = input.parentElement?.nextElementSibling;
                if (parentSibling && parentSibling.textContent?.includes(textToFind)) return true;

                let parent = input.parentElement;
                while (parent && parent.tagName !== 'LI' && parent.tagName !== 'BODY') {
                    if (parent.innerText && parent.innerText.includes(textToFind)) return true;
                    parent = parent.parentElement;
                }
                return false;
            });

            if (targetInput) {
                (targetInput as HTMLElement).click();
                return { found: true };
            }
            return { found: false };
        });

        if (selectionResult.found) {
            console.log('[ABL Rapipago] ✅ Service option selected (via Input click)');
        } else {
            console.log('[ABL Rapipago] ⚠️ Input not found, falling back to text click...');
            const labelText = 'COBRANZA SIN FACTURA';
            const serviceOption = await page.waitForSelector(`::-p-text(${labelText})`, { visible: true, timeout: 5000 }).catch(() => null);
            if (serviceOption) {
                await serviceOption.click();
            } else {
                throw new Error('Could not find service option');
            }
        }

        // ---------------------------------------------------------
        // 4. Input Partida
        // ---------------------------------------------------------
        await new Promise(r => setTimeout(r, 2000));
        console.log('[ABL Rapipago] Waiting for partida input...');

        const inputPartida = await page.waitForSelector('input[placeholder*="partida" i]', {
            visible: true,
            timeout: 10000
        });

        if (inputPartida) {
            await inputPartida.evaluate(el => el.scrollIntoView());
            await inputPartida.click();
            await new Promise(r => setTimeout(r, 500));
            await inputPartida.type(partida, { delay: 100 });

            // Dispatch React events explicit
            await inputPartida.evaluate(el => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            });

            await new Promise(r => setTimeout(r, 1000));
            console.log(`[ABL Rapipago] Entered partida: ${partida}`);
        } else {
            throw new Error('Partida input not found');
        }

        // Continuar - Coordinate Click (Robust for React Buttons)
        console.log('[ABL Rapipago] Looking for Continuar button...');

        let btnContinuar = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent?.includes('Continuar'));
        });

        if (btnContinuar) {
            const box = await btnContinuar.boundingBox();
            if (box) {
                console.log(`[ABL Rapipago] Clicking Continuar at ${box.x}, ${box.y}`);
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            } else {
                // Fallback
                await btnContinuar.click();
                console.log('[ABL Rapipago] Clicked Continuar (Element Click Fallback)');
            }
        } else {
            // Fallback
            await page.keyboard.press('Enter');
            console.log('[ABL Rapipago] Button not found, pressed Enter fallback');
        }

        // ---------------------------------------------------------
        // 5. Read Results
        // ---------------------------------------------------------
        console.log('[ABL Rapipago] Waiting for results...');
        await new Promise(r => setTimeout(r, 8000));

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();

            // Check for validation error
            const errorContainer = document.querySelector('.invoice-validation-error-container');
            if (errorContainer) {
                const desc = document.querySelector('.invoice-validation-error-description')?.textContent?.trim();
                // Ignore empty descriptions
                if (desc && desc.length > 0) {
                    return { noDebt: false, maxAmount: 0, error: desc, totalAmount: 0 };
                }
            }

            // Check for no debt
            const noDebt = lowerBody.includes('no registra deuda') ||
                lowerBody.includes('sin deuda') ||
                lowerBody.includes('no posee deuda') ||
                lowerBody.includes('saldo cancelado');

            // Check for amounts 
            const amountMatches = bodyText.match(/\$\s*([\d,.]+)/g);
            let totalAmount = 0;
            let maxAmount = 0;

            if (amountMatches) {
                const parsed = amountMatches.map(str => {
                    let clean = str.replace('$', '').trim();
                    let val = 0;
                    if (clean.includes(',') && clean.includes('.')) {
                        clean = clean.replace(/\./g, '').replace(',', '.');
                    } else if (clean.includes(',')) {
                        clean = clean.replace(',', '.');
                    }
                    val = parseFloat(clean);
                    return isNaN(val) ? 0 : val;
                });
                totalAmount = parsed.reduce((a, b) => a + b, 0);
                maxAmount = Math.max(...parsed);
            }

            return { noDebt, maxAmount, totalAmount, error: undefined };
        });

        console.log(`[ABL Rapipago] Result: NoDebt=${(result as any).noDebt}, MaxAmount=${(result as any).maxAmount}, Total=${(result as any).totalAmount}, Error=${(result as any).error}`);

        let finalResult: ABLRapipagoResult;

        if ((result as any).error) {
            finalResult = {
                status: 'ERROR',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: (result as any).error
            };
        } else if ((result as any).totalAmount > 0) {
            finalResult = {
                status: 'OVERDUE',
                debtAmount: (result as any).totalAmount,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else if (result.noDebt) {
            finalResult = {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else {
            console.log('[ABL Rapipago] ❓ Status UNKNOWN. Saving debug info...');
            try {
                await page.screenshot({ path: 'abl-unknown-status.png', fullPage: true });
                const finalHtml = await page.content();
                const fs = require('fs');
                fs.writeFileSync('abl-unknown-status.html', finalHtml);
            } catch (e) { }

            finalResult = {
                status: 'UNKNOWN',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Could not determine status (No debt text nor amount found)'
            };
        }

        await browser.close();
        return finalResult;

    } catch (error: any) {
        console.error('[ABL Rapipago] ❌ Error:', error.message);
        try {
            if (page && !page.isClosed()) await page.screenshot({ path: 'abl-rapipago-error-final.png' });
        } catch (e) { }

        if (browser) await browser.close();

        return {
            status: 'ERROR',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: error.message
        };
    }
}
