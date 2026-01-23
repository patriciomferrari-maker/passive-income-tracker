import puppeteer from 'puppeteer';

export interface AysaWebResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkAysaWeb(accountNumber: string): Promise<AysaWebResult> {
    console.log(`[AYSA Web] Checking account: ${accountNumber}`);

    // Launch browser (visible for reliability)
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.goto('https://oficinavirtual.web.aysa.com.ar/index.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait a bit for SPA load
        await new Promise(r => setTimeout(r, 3000));

        // 1. Click "Sin Registrarte" button using robust search
        const buttons = await page.$$('button, a, div[role="button"]');
        let startBtn;

        for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent || '');
            if (text.toLowerCase().includes('gestiones sin registrarte')) {
                startBtn = btn;
                break;
            }
        }

        if (startBtn) {
            await startBtn.click();
        } else {
            throw new Error('Start button not found');
        }

        // 2. Wait for inputs
        await page.waitForSelector('input', { timeout: 20000 });

        // 3. Fill form (using type for reliability)
        const inputs = await page.$$('input');
        if (inputs.length >= 3) {
            // Account
            await inputs[0].click();
            await inputs[0].type(accountNumber);

            // Email
            await inputs[1].click();
            await inputs[1].type('prueba@gmail.com');

            // Confirm Email
            await inputs[2].click();
            await inputs[2].type('prueba@gmail.com');
        } else {
            throw new Error(`Found only ${inputs.length} inputs, expected 3`);
        }

        await new Promise(r => setTimeout(r, 1000));

        // 4. Submit
        const submitButtons = await page.$$('button');
        let submitBtn;

        for (const btn of submitButtons) {
            const text = await btn.evaluate(el => el.textContent || '');
            const textUpper = text.toUpperCase();
            if (textUpper.includes('CONFIRMAR') || textUpper.includes('INGRESAR')) {
                const disabled = await btn.evaluate(el => el.hasAttribute('disabled'));
                if (!disabled) {
                    submitBtn = btn;
                    break;
                }
            }
        }

        if (submitBtn) {
            await submitBtn.click();
        } else {
            throw new Error('Submit button not found or disabled');
        }

        // 5. Check for "Verify Data" modal (Post-submission)
        console.log('[AYSA Web] Checking for intermediate confirmation modal...');
        await new Promise(r => setTimeout(r, 2000)); // Wait for modal animation

        const continueButtons = await page.$$('button');
        let continueBtn;

        for (const btn of continueButtons) {
            const text = await btn.evaluate(el => el.textContent || '');
            // Look for "CONTINUAR" specifically
            if (text.toUpperCase().includes('CONTINUAR')) {
                // Should be visible
                const visible = await btn.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
                });

                if (visible) {
                    continueBtn = btn;
                    break;
                }
            }
        }

        if (continueBtn) {
            console.log('[AYSA Web] Found validation modal, clicking Continuar...');
            await continueBtn.click();
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log('[AYSA Web] No validation modal found, proceeding...');
        }

        // 6. Wait for Results
        // Just wait 10 seconds fixed to be safe
        console.log('[AYSA Web] Waiting for final results...');
        await new Promise(r => setTimeout(r, 10000));

        // 6. Parse Results
        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText || ''; // innerText helps avoid hidden scripts
            const lowerBody = bodyText.toLowerCase();

            // Check for no debt
            // "no registra deuda" or "saldo a favor"
            // Exclude "preguntas frecuentes" context if possible, but innerText usually handles structure better
            const noDebt = lowerBody.includes('no registra deuda') ||
                lowerBody.includes('saldo a favor') ||
                lowerBody.includes('al día') ||
                lowerBody.includes('sin deuda vencida');

            // Check for amount
            const amounts = bodyText.match(/\$\s*[\d,.]+/g);
            let debtAmount = 0;

            if (amounts && amounts.length > 0) {
                const parsedAmounts = amounts.map(a => {
                    return parseFloat(a.replace('$', '').replace(/\./g, '').replace(',', '.').trim());
                });
                debtAmount = Math.max(...parsedAmounts);
            }

            return { noDebt, debtAmount };
        });

        if (result.noDebt) {
            return {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        }

        if (result.debtAmount > 0) {
            return {
                status: 'OVERDUE',
                debtAmount: result.debtAmount,
                lastBillAmount: result.debtAmount,
                lastBillDate: null,
                dueDate: null
            };
        }

        // If we really can't find anything, take a screenshot
        await page.screenshot({ path: `aysa-unknown-${accountNumber}.png`, fullPage: true });

        return {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: 'No se pudo determinar el estado'
        };

    } catch (error: any) {
        console.error('[AYSA Web] Error:', error);
        return {
            status: 'ERROR',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: error.message
        };
    } finally {
        await browser.close();
    }
}
