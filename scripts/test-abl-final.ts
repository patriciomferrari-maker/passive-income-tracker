// @ts-nocheck
import puppeteer from 'puppeteer';

(async () => {
    console.log('🚀 Starting ProntoPago ABL CABA Test (FINAL CLEAN) ...');

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

        // Step 0: Go to Direct URL
        console.log('0️⃣  Navigating directly to #/index/withoutinvoice ...');
        await page.goto('https://pagos.prontopago.com.ar/#/index/withoutinvoice', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await new Promise(r => setTimeout(r, 4000));

        // CHECK: Are we redirected to Login?
        const isLogin = await page.evaluate(() => document.body.innerText.includes('Continuar sin usuario'));
        if (isLogin) {
            console.log('⚠️  Redirected to Login/Landing. Clicking "Continuar sin usuario"...');
            await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('div, span, h6, p'));
                const target = elements.find(el => el.textContent?.trim() === 'Continuar sin usuario');
                if (target) (target as HTMLElement).click();
            });
            await new Promise(r => setTimeout(r, 3000));
        }

        // Step 1: Search "Patentes"
        console.log('1️⃣  Searching "Patentes"...');

        // Look for validation that we are on the right page
        // The search input usually has a placeholder like "Buscar empresa..."
        const searchInput = await page.waitForSelector('input[data-placeholder*="uscar"], input[aria-label*="uscar"], input', { timeout: 15000 }).catch(() => null);

        if (!searchInput) {
            console.log('❌ Input NOT found. Dumping page...');
            await page.screenshot({ path: 'scripts/debug-no-input.png' });
            throw new Error('Input field not found');
        }

        // Verify it's not the email input
        const inputType = await page.evaluate(el => el.getAttribute('type'), searchInput);
        if (inputType === 'email') {
            console.log('❌ Create: Found EMAIL input, not search input. Route failed.');
            throw new Error('Wrong input found (Email)');
        }

        await searchInput.type('patentes');
        await new Promise(r => setTimeout(r, 2000)); // Wait for results

        console.log('   Selecting "AGIP GCBA - ABL IIBB PATENTES"...');
        await new Promise(r => setTimeout(r, 2000)); // Wait for list to settle

        const optionClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('mat-option, div.mat-list-item, span'));
            const target = elements.find(el => el.textContent?.includes('AGIP GCBA - ABL IIBB PATENTES'));
            if (target) {
                target.scrollIntoView({ block: 'center', inline: 'center' });
                (target as HTMLElement).click();
                return true;
            }
            return false;
        });

        if (optionClicked) {
            console.log('✅ Clicked AGIP Option.');
        } else {
            console.log('❌ AGIP Option NOT found in DOM. Dumping text content...');
            // Log available text to debug what IS there
            const textContent = await page.evaluate(() => document.body.innerText.substring(0, 500));
            console.log(textContent);
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
        await page.screenshot({ path: 'scripts/debug-prontopago-final.png' });
    } finally {
        await browser.close();
        console.log('🛑 Done.');
    }
})();
