
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

        // 2. Search for "AGIP" (or handle location first based on my previous knowledge)
        // Note: The user's code assumes a direct search field. My previous experience showed Location -> Company.
        // I will try to follow the User's code logic but adapt if necessary.
        // User said: "await page.goto('https://www.rapipago.com.ar/rapipagoWeb/pagar-servicios'..."
        // My previous successful navigation was to 'https://pagar.rapipago.com.ar/rapipagoWeb/pagos/'
        // Let's stick to the URL I know works or try the one user gave if it's better.
        // User gave: rapiapagoWeb/pagar-servicios. 
        // Let's use the one I was using as base but with their logic for selectors.

        // Actually, let's strictly follow their logic for the "Selection" part which was the blocker.
        // But I need to get TO that selection first.
        // My previous flow: Location -> Click Pago Facturas -> Search Company -> Select Company -> PROBLEM.

        // Use my proven navigation to get to company selection
        await page.waitForSelector('input', { timeout: 10000 });
        await page.type('input', 'BUENOS AIRES', { delay: 100 });
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
        // Find the right input (usually the second one now?)
        // Let's try typing in the focused input or find usage of 'input'
        if (companyInput) {
            await companyInput.click();
            await companyInput.type('AGIP'); // User suggested AGIP
            await new Promise(r => setTimeout(r, 2000));

            // Select "AGIP GCBA - ABL IIBB PATENTES"
            // Find text "ABL" or "AGIP" in dropdown
            const option = await page.waitForSelector('::-p-text(AGIP GCBA - ABL IIBB PATENTES)', { timeout: 5000 }).catch(() => null);

            if (option) {
                await option.click();
            } else {
                // Fallback to my previous keyboard method which worked
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
            }
        }

        console.log('[ABL Rapipago] Company selected');

        // ---------------------------------------------------------
        // 3. THE FIX: Text-based selector for Service Type
        // ---------------------------------------------------------
        console.log('[ABL Rapipago] Waiting for service options...');

        // User's fix: wait for text "COBRANZA SIN FACTURA - PLAN DE FACILIDADES"
        const labelSinFactura = await page.waitForSelector('::-p-text(COBRANZA SIN FACTURA - PLAN DE FACILIDADES)', {
            timeout: 20000,
            visible: true
        });

        if (labelSinFactura) {
            // Scroll ensuring it's in view
            await labelSinFactura.evaluate(el => el.scrollIntoView());
            await new Promise(r => setTimeout(r, 500));
            await labelSinFactura.click();
            console.log('[ABL Rapipago] ✅ Service option selected via text');
        } else {
            throw new Error('Could not find service option "COBRANZA SIN FACTURA"');
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
            const noDebt = lowerBody.includes('no registra deuda') || lowerBody.includes('sin deuda');

            // Check for amounts
            // Look for "$ 1.500,50" style
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

        await browser.close();

        if (result.noDebt) {
            return {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else if (result.maxAmount > 0) {
            return {
                status: 'OVERDUE',
                debtAmount: result.maxAmount,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else {
            // Fallback: If no debt text but also no amount found on result page?
            // Might be "Error" or "Unknown"
            return {
                status: 'UNKNOWN',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Could not determine status (No debt text nor amount found)'
            };
        }

    } catch (error: any) {
        console.error('[ABL Rapipago] ❌ Error:', error.message);
        if (page) await page.screenshot({ path: 'abl-rapipago-error-final.png' });
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
