
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

        // Step 2: Select location - Type BUENOS AIRES and click dropdown option
        await page.waitForSelector('input', { timeout: 10000 });
        await page.type('input', 'BUENOS AIRES', { delay: 100 });
        console.log('[ABL Rapipago] Typed "BUENOS AIRES"');
        await new Promise(r => setTimeout(r, 2000));

        // Click BUENOS AIRES from dropdown using keyboard
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');

        console.log('[ABL Rapipago] Location selected');
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

        // Step 4: Search for company - type IIBB PATENTES
        await page.waitForSelector('input', { timeout: 10000 });
        const inputs = await page.$$('input');

        for (const input of inputs) {
            const isVisible = await input.isIntersectingViewport();
            if (isVisible) {
                await input.click();
                await input.type('IIBB PATENTES', { delay: 100 });
                break;
            }
        }

        console.log('[ABL Rapipago] Typed IIBB PATENTES');
        await new Promise(r => setTimeout(r, 2000));

        // Select from dropdown using keyboard
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');

        console.log('[ABL Rapipago] Company selected from dropdown');
        await new Promise(r => setTimeout(r, 5000)); // Wait for service page to load

        // Step 5: Select service type using physical mouse click (ROBUST STRATEGY)
        console.log('[ABL Rapipago] Looking for service option for mouse click...');

        try {
            await new Promise(r => setTimeout(r, 2000));

            const elementInfo = await page.evaluate(() => {
                const searchText = 'COBRANZA SIN FACTURA - PLAN DE FACILIDADES';
                const candidates = Array.from(document.querySelectorAll('label, div, span, mat-radio-button, p'));

                for (const el of candidates) {
                    if (el.textContent && el.textContent.includes(searchText)) {
                        const rect = el.getBoundingClientRect();
                        // Ensure element has size and is likely visible
                        if (rect.width > 0 && rect.height > 0) {
                            return {
                                x: rect.x + rect.width / 2,
                                y: rect.y + rect.height / 2,
                                tag: el.tagName,
                                text: el.textContent.trim().substring(0, 50)
                            };
                        }
                    }
                }
                return null;
            });

            if (elementInfo) {
                console.log(`[ABL Rapipago] Clicking element ${elementInfo.tag} at (${elementInfo.x}, ${elementInfo.y})`);
                await page.mouse.click(elementInfo.x, elementInfo.y, { button: 'left', delay: 100 });
                await new Promise(r => setTimeout(r, 1000));

                // Click again just to be sure (common fix for some UI frameworks)
                await page.mouse.click(elementInfo.x, elementInfo.y, { button: 'left', delay: 100 });
                console.log('[ABL Rapipago] Double click executed');

                await new Promise(r => setTimeout(r, 3000)); // Wait for UI
                await page.screenshot({ path: 'abl-rapipago-click-debug.png' });
            } else {
                throw new Error('Could not find visible element with service text');
            }
        } catch (e: any) {
            console.log('[ABL Rapipago] ⚠️  Click error:', e.message);
            await page.screenshot({ path: 'abl-rapipago-click-error.png' });
            return {
                status: 'ERROR',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Could not select service type option'
            };
        }

        // Step 6: Enter partida number
        console.log('[ABL Rapipago] Looking for partida input...');

        try {
            // Find input by placeholder - using case insensitive partial match
            const partidaInput = await page.waitForSelector('input[placeholder*="partida" i]', {
                timeout: 5000,
                visible: true
            });

            if (partidaInput) {
                await partidaInput.evaluate(el => el.scrollIntoView());
                await partidaInput.click();
                await new Promise(r => setTimeout(r, 500));
                await partidaInput.type(partida, { delay: 100 });
                console.log(`[ABL Rapipago] Entered partida: ${partida}`);
            } else {
                throw new Error('Partida input not found');
            }
        } catch (e: any) {
            console.log('[ABL Rapipago] ⚠️  Could not find partida input:', e.message);
            await page.screenshot({ path: 'abl-rapipago-partida-error.png' });
            return {
                status: 'ERROR',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'Could not find partida input field'
            };
        }

        await new Promise(r => setTimeout(r, 1500));

        // Step 7: Click Continuar button
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
        await new Promise(r => setTimeout(r, 5000)); // Wait for results

        // Step 8: Parse results
        const resultData = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const amountMatches = bodyText.match(/\$\s*([\d,.]+)/g);
            const noDebt = bodyText.toLowerCase().includes('no registra deuda') ||
                bodyText.toLowerCase().includes('sin deuda');

            return {
                bodyText: bodyText.substring(0, 800),
                amounts: amountMatches || [],
                noDebt,
                url: window.location.href
            };
        });

        console.log('[ABL Rapipago] Current URL:', resultData.url);
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
            const amounts = resultData.amounts.map(a => {
                let numStr = a.replace('$', '').trim();

                if (numStr.includes('.') && numStr.includes(',')) {
                    numStr = numStr.replace(/\./g, '').replace(',', '.');
                } else if (numStr.includes('.')) {
                    const parts = numStr.split('.');
                    if (parts[1] && parts[1].length <= 2) {
                        // Decimal point
                    } else {
                        numStr = numStr.replace(/\./g, '');
                    }
                } else if (numStr.includes(',')) {
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
            // await browser.close();
            // Using browser.disconnect() or simply not closing if successful in debugging
            // For now closing to keep it clean
            await browser.close();
        }
    }
}
