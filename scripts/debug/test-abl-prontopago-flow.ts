// @ts-nocheck
import puppeteer from 'puppeteer';

(async () => {
    console.log('🚀 Starting ProntoPago ABL CABA Test (User Flow) - VERSION CHECK 2...');

    // Sample Partida provided by user
    const TEST_PARTIDA = '3786683';

    const browser = await puppeteer.launch({
        headless: false, // Visual debug
        defaultViewport: null,
        args: ['--start-maximized']
    });

    let page;
    try {
        page = await browser.newPage();

        // Step 0: Go to Home/Login
        console.log('0️⃣  Navigating to Home...');
        await page.goto('https://pagos.prontopago.com.ar/#/login', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await new Promise(r => setTimeout(r, 2000));

        // Step 1: "Continuar sin usuario"
        console.log('1️⃣  Clicking "Continuar sin usuario"...');
        const continueBtn = await page.evaluateHandle(() => {
            const elements = Array.from(document.querySelectorAll('div, span, p, h6')); // Broad search
            return elements.find(el => el.textContent?.trim() === 'Continuar sin usuario');
        });

        if (continueBtn) {
            await page.evaluate((el: any) => el.click(), continueBtn);
        } else {
            console.log('⚠️  "Continuar sin usuario" not found. Maybe already logged out or on landing? Checking URL...');
            // If we are already redirected or on another page, check if we can proceed.
            // Try to find "Buscar por empresa..." directly just in case.
        }
        await new Promise(r => setTimeout(r, 2000));

        // Step 2: "Buscar por empresa y dato de referencia"
        console.log('2️⃣  Clicking "Buscar por empresa..."');
        // This is likely a card or button.
        const searchMethodBtn = await page.evaluateHandle(() => {
            const elements = Array.from(document.querySelectorAll('div, span, button'));
            return elements.find(el => el.textContent?.includes('Buscar por empresa y dato de referencia'));
        });

        if (searchMethodBtn) {
            console.log('   Target Element:', await page.evaluate((el: any) => el.outerHTML.substring(0, 100), searchMethodBtn));
            await page.evaluate((el: any) => el.click(), searchMethodBtn);
        } else {
            // Maybe we are already there?
            console.log('⚠️  Button not found, checking if input exists...');
        }
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: 'scripts/debug-step2.png' });

        // Step 3: Search "Patentes" and select AGIP
        console.log('3️⃣  Searching "Patentes"...');
        // Relaxed selector
        const searchInput = await page.waitForSelector('input', { timeout: 10000 }).catch(() => null);

        if (!searchInput) {
            console.log('❌ Input NOT found. Dumping page...');
            await page.screenshot({ path: 'scripts/debug-no-input.png' });
            throw new Error('Input field not found');
        }

        await searchInput.type('patentes');
        await new Promise(r => setTimeout(r, 2000)); // Wait for results

        console.log('   Selecting "AGIP GCBA - ABL IIBB PATENTES"...');
        const agipOption = await page.evaluateHandle(() => {
            // Probably a list item or card
            const elements = Array.from(document.querySelectorAll('div, mat-option, span'));
            // Exact match or contains
            return elements.find(el => el.textContent?.includes('AGIP GCBA - ABL IIBB PATENTES'));
        });

        if (agipOption) {
            await page.evaluate((el: any) => el.click(), agipOption);
        } else {
            throw new Error('AGIP Option not found');
        }
        await new Promise(r => setTimeout(r, 2000));

        // Step 4: Modalidad de Pago -> "COBRANZA SIN FACTURA - PLAN DE FACILIDADES"
        console.log('4️⃣  Selecting Payment Mode...');

        // Click dropdown first
        const dropdown = await page.$('.mat-select-trigger');
        if (dropdown) {
            await dropdown.click();
        } else {
            console.log('   Dropdown selector not found, trying text click "Seleccione una opción"...');
            await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('span'));
                els.find(el => el.textContent?.includes('Seleccione una opción'))?.click();
            });
        }
        await new Promise(r => setTimeout(r, 1000));

        // Click Option
        console.log('   Clicking "PLAN DE FACILIDADES"...');
        const planOption = await page.evaluateHandle(() => {
            const options = Array.from(document.querySelectorAll('span, mat-option, div[role="option"]'));
            return options.find(el => el.textContent?.includes('COBRANZA SIN FACTURA - PLAN DE FACILIDADES'));
        });

        if (planOption) {
            await page.evaluate((el: any) => el.click(), planOption);
        } else {
            throw new Error('Plan de facilidades option not found');
        }
        await new Promise(r => setTimeout(r, 1000));

        // Step 5: Enter Partida
        console.log('5️⃣  Entering Partida:', TEST_PARTIDA);

        // Locate the new input
        // It should appear after selection.
        const partidaInput = await page.waitForSelector('input[data-placeholder*="partida"], input[id*="mat-input"]', { timeout: 5000 }).catch(() => null);

        // If specific selector fails, find by generic input
        if (!partidaInput) {
            const inputs = await page.$$('input');
            // Typically the last one or the one visible
            if (inputs.length > 0) {
                await inputs[inputs.length - 1].type(TEST_PARTIDA);
                await page.keyboard.press('Enter');
            } else {
                throw new Error('Partida input not found');
            }
        } else {
            await partidaInput.type(TEST_PARTIDA);
            await page.keyboard.press('Enter');
        }

        // Step 6: Wait for and Parse Results
        console.log('6️⃣  Waiting for results...');
        await new Promise(r => setTimeout(r, 6000));

        const result = await page.evaluate(() => {
            const body = document.body.innerText;
            return {
                textSnapshot: body.substring(0, 500).replace(/\n/g, ' '),
                hasDebt: body.includes('$'),
                amounts: Array.from(document.querySelectorAll('mat-cell, span'))
                    .filter(el => el.textContent?.includes('$'))
                    .map(el => el.textContent?.trim())
            };
        });

        console.log('📊 Result Snapshot:', result);

    } catch (error: any) {
        console.error('❌ Error in flow:', error.message);
        await page.screenshot({ path: 'scripts/debug-prontopago-flow.png' });
    } finally {
        await browser.close();
        console.log('🛑 Done.');
    }
})();
