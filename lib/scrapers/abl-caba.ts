
import { getBrowser } from '@/app/lib/browser-helper';
import { Browser, Page } from 'puppeteer-core';

export interface ABLCABAResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

/**
 * Checks ABL CABA debt via Rapipago portal.
 * Use robust logic from test-abl-rapipago-standalone.ts
 */
export async function checkABLCABA(partida: string): Promise<ABLCABAResult> {
    console.log(`🏛️ [ABL Rapipago] Checking partida: ${partida}`);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await getBrowser() as unknown as Browser;

        page = await browser.newPage();

        // 1. Navigate directly to Rapipago payments section
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // 2. Human Behavior Emulation
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        await page.mouse.move(Math.random() * 500, Math.random() * 500, { steps: 20 });
        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise(r => setTimeout(r, 500));
        await page.evaluate(() => window.scrollBy(0, -300));

        // 3. Select Location (CAPITAL FEDERAL)
        const inputLoc = await page.waitForSelector('input', { visible: true });
        if (inputLoc) {
            await inputLoc.click();
            await new Promise(r => setTimeout(r, 500));
            for (const char of 'CAPITAL FEDERAL') {
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

        // 5. Search for Company "AGIP"
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
        if (companyInput) {
            await companyInput.click();
            await new Promise(r => setTimeout(r, 400));
            // Type AGIP
            for (const char of 'AGIP') {
                await page.keyboard.type(char, { delay: 150 });
            }
            await new Promise(r => setTimeout(r, 2000));

            // Native keyboard flow is more reliable
            await page.keyboard.press('ArrowDown');
            await new Promise(r => setTimeout(r, 500));
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 1500));
        await page.waitForFunction(() => document.body.innerText.includes('COBRANZA SIN FACTURA'), { timeout: 20000 });

        // 6. Select Service Option
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
                const rect = (targetInput as HTMLElement).getBoundingClientRect();
                (targetInput as HTMLElement).click();
                return { found: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
            return { found: false };
        });

        if (selectionResult.found) {
            await page.mouse.move(selectionResult.x || 0, selectionResult.y || 0, { steps: 10 });
        } else {
            const serviceOption = await page.waitForSelector(`::-p-text(COBRANZA SIN FACTURA)`, { visible: true, timeout: 5000 }).catch(() => null);
            if (serviceOption) await serviceOption.click();
        }

        // 7. Input Partida
        await new Promise(r => setTimeout(r, 2000));
        const inputSelector = 'input[placeholder*="partida" i]';
        let inputPartida = await page.waitForSelector(inputSelector, { visible: true, timeout: 10000 }).catch(() => null);

        if (!inputPartida) {
            console.log('🏛️ [ABL Rapipago] Partida input not found, searching for "Continuar" to advance...');
            const btnContinueService = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null);
            if (btnContinueService) {
                await btnContinueService.click();
                await new Promise(r => setTimeout(r, 3000));
                inputPartida = await page.waitForSelector('input:not([type="checkbox"]):not([type="radio"])', { visible: true, timeout: 10000 }).catch(() => null);
            }
        }

        if (inputPartida) {
            await inputPartida.click();
            await page.evaluate((el) => {
                const input = el as HTMLInputElement;
                input.value = '';
            }, inputPartida);

            await new Promise(r => setTimeout(r, 500));
            await inputPartida.type(partida, { delay: 150 });
            await page.mouse.move(Math.floor(Math.random() * 500), Math.floor(Math.random() * 500));

            await page.evaluate((el) => {
                const input = el as HTMLInputElement;
                input.blur();
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, inputPartida);

            await new Promise(r => setTimeout(r, 1500));
        } else {
            throw new Error('Partida input not found after selecting service');
        }

        // 8. Continue
        const btnContinuar = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null) as any;
        if (btnContinuar) {
            const isDisabled = await page.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'), btnContinuar);
            if (!isDisabled) {
                await btnContinuar.click();
            } else {
                await new Promise(r => setTimeout(r, 2000));
                await btnContinuar.click();
            }
        } else {
            await page.keyboard.press('Enter');
        }

        // 9. Read Results
        await new Promise(r => setTimeout(r, 8000));

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();

            const errorContainer = document.querySelector('.invoice-validation-error-container');
            if (errorContainer) {
                const desc = document.querySelector('.invoice-validation-error-description')?.textContent?.trim();
                if (desc && desc.length > 0) return { error: desc, bodyTextSnippet: bodyText.substring(0, 500) };
            }

            const noDebtIndicators = [
                'no registra deuda',
                'sin deuda',
                'saldo cancelado',
                'no posee deuda',
                'no se encontraron facturas',
                'no hay facturas'
            ];
            const noDebt = noDebtIndicators.some(t => lowerBody.includes(t));

            const amountMatches = bodyText.match(/\$\s*([\d,.]+)/g);
            let totalAmount = 0;
            if (amountMatches) {
                const parsed = amountMatches.map(str => {
                    let clean = str.replace('$', '').trim();
                    if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                    else if (clean.includes(',')) clean = clean.replace(',', '.');
                    return parseFloat(clean) || 0;
                });
                totalAmount = parsed.reduce((a, b) => a + b, 0);
            }
            return { noDebt, totalAmount, bodyTextSnippet: bodyText.substring(0, 1000) };
        });

        console.log(`🏛️ [ABL Rapipago] Parser result:`, { noDebt: (result as any).noDebt, totalAmount: (result as any).totalAmount });
        if (!(result as any).noDebt && (result as any).totalAmount === 0) {
            console.log(`🏛️ [ABL Rapipago] Body Snippet:`, (result as any).bodyTextSnippet);
        }

        let finalResult: ABLCABAResult;
        if ((result as any).error) {
            finalResult = { status: 'ERROR', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: (result as any).error };
        } else if ((result as any).totalAmount > 0) {
            finalResult = { status: 'OVERDUE', debtAmount: (result as any).totalAmount, lastBillAmount: null, lastBillDate: null, dueDate: null };
        } else if ((result as any).noDebt) {
            finalResult = { status: 'UP_TO_DATE', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null };
        } else {
            finalResult = { status: 'UNKNOWN', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: 'Could not determine status' };
        }

        await browser.close();
        return finalResult;

    } catch (error: any) {
        if (browser) await browser.close();
        console.error(`❌ [ABL Rapipago] Error: ${error.message}`);
        return { status: 'ERROR', debtAmount: 0, lastBillAmount: null, lastBillDate: null, dueDate: null, errorMessage: error.message };
    }
}
