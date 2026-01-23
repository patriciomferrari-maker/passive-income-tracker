
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
            headless: false, // Keep visible for reliability/debugging as per suggestion
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
        await page.waitForSelector('input', { timeout: 10000 });
        await page.type('input', 'CAPITAL FEDERAL', { delay: 100 });
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

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

        const selectionResult = await page.evaluate(() => {
            const textToFind = 'COBRANZA SIN FACTURA';
            // Based on debug HTML, these are checkboxes, not radios
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));

            const targetInput = inputs.find(input => {
                // Structure in Rapipago: <li> <div><input></div> <label>TEXT</label> </li>
                const parentSibling = input.parentElement?.nextElementSibling;
                if (parentSibling && parentSibling.textContent?.includes(textToFind)) return true;

                // Fallback checks
                const p = input.parentElement?.innerText || '';
                const gp = input.parentElement?.parentElement?.innerText || '';
                return p.includes(textToFind) || gp.includes(textToFind);
            });

            if (targetInput) {
                (targetInput as HTMLElement).click();
                return { found: true };
            }
            return { found: false };
        });

        if (selectionResult.found) {
            console.log('[ABL Rapipago] ✅ Service option selected (checkbox/radio)');
        } else {
            console.log('[ABL Rapipago] ⚠️ Input not found, falling back to text click...');
            const labelSinFactura = await page.waitForSelector('::-p-text(COBRANZA SIN FACTURA - PLAN DE FACILIDADES)', {
                timeout: 5000,
                visible: true
            });
            if (labelSinFactura) {
                await labelSinFactura.click();
            } else {
                throw new Error('Could not find service option "COBRANZA SIN FACTURA"');
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
            console.log(`[ABL Rapipago] Entered partida: ${partida}`);
        } else {
            throw new Error('Partida input not found');
        }

        // Continuar
        const btnContinuar = await page.waitForSelector('::-p-text(Continuar)', { visible: true });
        if (btnContinuar) {
            await btnContinuar.click();
            console.log('[ABL Rapipago] Clicked Continuar');
        }

        // ---------------------------------------------------------
        // 5. Read Results
        // ---------------------------------------------------------
        console.log('[ABL Rapipago] Waiting for results...');
        await new Promise(r => setTimeout(r, 5000)); // Wait for generic load

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();

            // Check for no debt
            const noDebt = lowerBody.includes('no registra deuda') ||
                lowerBody.includes('sin deuda') ||
                lowerBody.includes('no posee deuda') ||
                lowerBody.includes('saldo cancelado');

            // Check for amounts
            const amountMatches = bodyText.match(/\$\s*([\d,.]+)/g);
            let maxAmount = 0;

            if (amountMatches) {
                const parsed = amountMatches.map(str => {
                    const num = str.replace('$', '').replace(/\./g, '').replace(',', '.').trim();
                    return parseFloat(num);
                });
                maxAmount = Math.max(...parsed);
            }

            return { noDebt, maxAmount };
        });

        console.log(`[ABL Rapipago] Result: NoDebt=${result.noDebt}, Amount=${result.maxAmount}`);

        let finalResult: ABLRapipagoResult;

        if (result.noDebt) {
            finalResult = {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else if (result.maxAmount > 0) {
            finalResult = {
                status: 'OVERDUE',
                debtAmount: result.maxAmount,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else {
            // Debug: Dump page content if unknown
            console.log('[ABL Rapipago] ❓ Status UNKNOWN. Saving debug info...');
            // Check if page session is still valid
            try {
                await page.screenshot({ path: 'abl-unknown-status.png', fullPage: true });
                const finalHtml = await page.content();
                const fs = require('fs');
                fs.writeFileSync('abl-unknown-status.html', finalHtml);
            } catch (e) {
                console.error('[ABL Rapipago] Failed to save debug info:', e);
            }

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
