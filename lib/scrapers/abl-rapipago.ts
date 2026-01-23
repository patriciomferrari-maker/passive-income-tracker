import puppeteer from 'puppeteer';

export interface ABLRapipagoResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkABLRapipago(partida: string): Promise<ABLRapipagoResult> {
    let browser;

    try {
        console.log(`[ABL Rapipago] Checking partida: ${partida}`);

        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
            defaultViewport: null
        });

        const page = await browser.newPage();

        // Step 1: Navigate to Rapipago
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('[ABL Rapipago] Page loaded');
        await new Promise(r => setTimeout(r, 2000));

        // Step 2: Type "BUENOS" in the location field and select "BUENOS AIRES"
        const locationInput = await page.$('input');
        if (locationInput) {
            await locationInput.type('BUENOS');
            await new Promise(r => setTimeout(r, 1500));

            // Click on "BUENOS AIRES" option
            await page.evaluate(() => {
                const options = Array.from(document.querySelectorAll('div'));
                const buenosAires = options.find(div =>
                    div.textContent?.trim() === 'BUENOS AIRES'
                );
                if (buenosAires) {
                    (buenosAires as HTMLElement).click();
                }
            });

            console.log('[ABL Rapipago] Selected BUENOS AIRES');
            await new Promise(r => setTimeout(r, 2000));
        }

        // Step 3: Click "Pago de Facturas" button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div, button, a'));
            const pagoFacturas = buttons.find(el =>
                el.textContent?.toLowerCase().includes('pago de facturas')
            );
            if (pagoFacturas) {
                (pagoFacturas as HTMLElement).click();
            }
        });

        console.log('[ABL Rapipago] Clicked Pago de Facturas');
        await new Promise(r => setTimeout(r, 3000));

        // Step 4: Search for "AGIP GCBA - ABL IIBB PATENTES"
        const searchInput = await page.$('input[placeholder*="empresa" i], input[type="text"]');
        if (searchInput) {
            await searchInput.type('abl');
            await new Promise(r => setTimeout(r, 2000));

            // Click on "AGIP GCBA - ABL IIBB PATENTES"
            await page.evaluate(() => {
                const options = Array.from(document.querySelectorAll('div, li'));
                const agip = options.find(el =>
                    el.textContent?.includes('AGIP GCBA') &&
                    el.textContent?.includes('ABL IIBB PATENTES')
                );
                if (agip) {
                    (agip as HTMLElement).click();
                }
            });

            console.log('[ABL Rapipago] Selected AGIP GCBA');
            await new Promise(r => setTimeout(r, 2000));
        }

        // Step 5: Select "COBRANZA SIN FACTURA - PLAN DE FACILIDADES"
        await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('div, li, button'));
            const cobranza = options.find(el =>
                el.textContent?.includes('COBRANZA SIN FACTURA') &&
                el.textContent?.includes('PLAN DE FACILIDADES')
            );
            if (cobranza) {
                (cobranza as HTMLElement).click();
            }
        });

        console.log('[ABL Rapipago] Selected COBRANZA SIN FACTURA');
        await new Promise(r => setTimeout(r, 2000));

        // Step 6: Enter partida number
        const partidaInputs = await page.$$('input[type="text"], input[type="number"]');
        if (partidaInputs.length > 0) {
            // Try the last visible input (usually the partida field)
            const lastInput = partidaInputs[partidaInputs.length - 1];
            await lastInput.click();
            await lastInput.type(partida);

            console.log(`[ABL Rapipago] Entered partida: ${partida}`);
            await new Promise(r => setTimeout(r, 1500));

            // Press Enter or click submit button
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 5000));
        }

        // Step 7: Parse results
        const resultData = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            // Look for debt amount
            const amountMatch = bodyText.match(/\$\s*([\d,.]+)/);
            const hasDebt = bodyText.toLowerCase().includes('total a pagar') ||
                bodyText.toLowerCase().includes('importe');
            const noDebt = bodyText.toLowerCase().includes('no registra deuda') ||
                bodyText.toLowerCase().includes('sin deuda');

            return {
                bodyText: bodyText.substring(0, 500),
                amountMatch: amountMatch ? amountMatch[1] : null,
                hasDebt,
                noDebt
            };
        });

        console.log('[ABL Rapipago] Result preview:', resultData.bodyText.substring(0, 200));

        let result: ABLRapipagoResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (resultData.noDebt) {
            result.status = 'UP_TO_DATE';
        } else if (resultData.amountMatch) {
            result.status = 'OVERDUE';
            result.debtAmount = parseFloat(resultData.amountMatch.replace(/\./g, '').replace(',', '.'));
        }

        console.log(`[ABL Rapipago] Status: ${result.status}, Debt: $${result.debtAmount}`);
        return result;

    } catch (error: any) {
        console.error('[ABL Rapipago] Error:', error.message);
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
            console.log('[ABL Rapipago] Closing browser in 5 seconds...');
            await new Promise(r => setTimeout(r, 5000));
            await browser.close();
        }
    }
}
