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
        await new Promise(r => setTimeout(r, 3000));

        // Step 2: Select location - Type and click BUENOS AIRES from dropdown
        await page.waitForSelector('input', { timeout: 10000 });
        await page.type('input', 'BUENOS AIRES', { delay: 100 });
        console.log('[ABL Rapipago] Typed "BUENOS AIRES"');
        await new Promise(r => setTimeout(r, 2000));

        // Click on BUENOS AIRES option from dropdown
        const locationClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const buenosAires = elements.find(el => {
                const text = el.textContent?.trim();
                return text === 'BUENOS AIRES';
            });
            if (buenosAires) {
                (buenosAires as HTMLElement).click();
                return true;
            }
            return false;
        });

        console.log(`[ABL Rapipago] Location clicked: ${locationClicked}`);
        await new Promise(r => setTimeout(r, 3000));

        // Step 3: Click "Pago de Facturas"
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const pagoFacturas = elements.find(el =>
                el.textContent?.trim().toLowerCase() === 'pago de facturas'
            );
            if (pagoFacturas) {
                (pagoFacturas as HTMLElement).click();
            }
        });

        console.log('[ABL Rapipago] Clicked Pago de Facturas');
        await new Promise(r => setTimeout(r, 4000));

        // Step 4: Search for company - wait for search input
        await page.waitForSelector('input', { timeout: 10000 });
        const inputs = await page.$$('input');

        // Find the search input (usually the visible one after location)
        for (const input of inputs) {
            const isVisible = await input.isIntersectingViewport();
            if (isVisible) {
                await input.click();
                await input.type('ABL', { delay: 100 });
                break;
            }
        }

        console.log('[ABL Rapipago] Typed ABL');
        await new Promise(r => setTimeout(r, 3000));

        // Click on first option that appears (AGIP GCBA - ABL IIBB PATENTES)
        const companyClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const agip = elements.find(el => {
                const text = el.textContent || '';
                return text.includes('AGIP GCBA') && text.includes('ABL');
            });
            if (agip) {
                (agip as HTMLElement).click();
                return true;
            }
            return false;
        });

        console.log(`[ABL Rapipago] Company selected: ${companyClicked}`);
        await new Promise(r => setTimeout(r, 3000));

        // Step 5: Select service type
        const serviceSelected = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const cobranza = elements.find(el => {
                const text = el.textContent || '';
                return text.includes('COBRANZA SIN FACTURA') && text.includes('FACILIDADES');
            });
            if (cobranza) {
                (cobranza as HTMLElement).click();
                return true;
            }
            return false;
        });

        console.log(`[ABL Rapipago] Service type selected: ${serviceSelected}`);
        await new Promise(r => setTimeout(r, 8000)); // Increased wait for page to load

        // Step 6: Enter partida - wait for and find the partida input field
        console.log('[ABL Rapipago] Looking for partida input field...');
        await new Promise(r => setTimeout(r, 2000));

        const allInputs = await page.$$('input');
        console.log(`[ABL Rapipago] Found ${allInputs.length} input fields`);
        let partidaEntered = false;

        for (let i = 0; i < allInputs.length; i++) {
            const input = allInputs[i];
            const isVisible = await input.isIntersectingViewport();
            const type = await input.evaluate(el => el.getAttribute('type'));
            const placeholder = await input.evaluate(el => el.getAttribute('placeholder'));

            console.log(`[ABL Rapipago] Input ${i}: visible=${isVisible}, type=${type}, placeholder=${placeholder}`);

            // Look specifically for the partida input field
            if (isVisible && placeholder && placeholder.toLowerCase().includes('partida')) {
                await input.click();
                await new Promise(r => setTimeout(r, 500));
                await input.type(partida, { delay: 100 });
                partidaEntered = true;
                console.log(`[ABL Rapipago] Entered partida: ${partida}`);
                break;
            }
            // Fallback: if no placeholder, check if it's a text/number input
            else if (isVisible && (type === 'text' || type === 'number' || !type) && !placeholder) {
                if (type === 'text' || type === 'number' || !type) {
                    await input.click();
                    await new Promise(r => setTimeout(r, 500));
                    await input.type(partida, { delay: 100 });
                    partidaEntered = true;
                    console.log(`[ABL Rapipago] Entered partida: ${partida}`);
                    break;
                }
            }
        }

        if (!partidaEntered) {
            console.log('[ABL Rapipago] ⚠️  Could not find partida input');
            return {
                status: 'ERROR',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Could not find partida input field'
            };
        }

        // Step 7: Wait for invoices list and select first invoice
        await new Promise(r => setTimeout(r, 3000));

        const invoiceSelected = await page.evaluate(() => {
            const radios = document.querySelectorAll('input[type="radio"]');
            if (radios.length > 0) {
                (radios[0] as HTMLInputElement).click();
                return true;
            }
            return false;
        });

        console.log(`[ABL Rapipago] Invoice selected: ${invoiceSelected}`);
        await new Promise(r => setTimeout(r, 1500));

        // Click Continuar button
        const continuarClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const continuar = buttons.find(btn =>
                btn.textContent?.toLowerCase().includes('continuar')
            );
            if (continuar) {
                (continuar as HTMLElement).click();
                return true;
            }
            return false;
        });

        console.log(`[ABL Rapipago] Continuar clicked: ${continuarClicked}`);
        await new Promise(r => setTimeout(r, 5000));

        // Step 8: Parse results
        const resultData = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            // Look for various debt indicators
            const amountMatches = bodyText.match(/\$\s*([\d,.]+)/g);
            const hasTotal = bodyText.toLowerCase().includes('total');
            const hasImporte = bodyText.toLowerCase().includes('importe');
            const noDebt = bodyText.toLowerCase().includes('no registra deuda') ||
                bodyText.toLowerCase().includes('sin deuda') ||
                bodyText.toLowerCase().includes('no posee deuda');

            return {
                bodyText: bodyText.substring(0, 800),
                amounts: amountMatches || [],
                hasTotal,
                hasImporte,
                noDebt,
                url: window.location.href
            };
        });

        console.log('[ABL Rapipago] Current URL:', resultData.url);
        console.log('[ABL Rapipago] Result preview:', resultData.bodyText.substring(0, 300));
        console.log('[ABL Rapipago] Amounts found:', resultData.amounts);

        let result: ABLRapipagoResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (resultData.noDebt) {
            result.status = 'UP_TO_DATE';
        } else if (resultData.amounts.length > 0) {
            // Parse amounts - handle both formats: "$ 1.234,56" and "$ 29181.2"
            const amounts = resultData.amounts.map(a => {
                // Remove $ and spaces
                let numStr = a.replace('$', '').trim();

                // If it has both dot and comma, it's Argentine format: dot=thousands, comma=decimal
                if (numStr.includes('.') && numStr.includes(',')) {
                    numStr = numStr.replace(/\./g, '').replace(',', '.');
                }
                // If it only has a dot and the part after dot has 1-2 digits, it's decimal
                else if (numStr.includes('.')) {
                    const parts = numStr.split('.');
                    if (parts[1] && parts[1].length <= 2) {
                        // It's already in correct format (decimal point)
                    } else {
                        // It's thousands separator, remove it
                        numStr = numStr.replace(/\./g, '');
                    }
                }
                // If it only has comma, it's decimal separator
                else if (numStr.includes(',')) {
                    numStr = numStr.replace(',', '.');
                }

                return parseFloat(numStr);
            });

            result.debtAmount = Math.max(...amounts);
            result.status = result.debtAmount > 0 ? 'OVERDUE' : 'UP_TO_DATE';
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
            console.log('[ABL Rapipago] Closing browser in 10 seconds...');
            await new Promise(r => setTimeout(r, 10000));
            await browser.close();
        }
    }
}
