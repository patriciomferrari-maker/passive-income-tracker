
import puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';

const PARTIDA = '3786683';

async function checkABLRapipago(partida: string) {
    console.log(`🏛️ [ABL Rapipago] Checking partida: ${partida}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    // 1. Navigate directly to Rapipago payments section
    console.log('[ABL Rapipago] Navigating to Rapipago...');
    await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    console.log('[ABL Rapipago] Page loaded. Starting human behavior...');

    // Initial "reading" pause and mouse jitter
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    await page.mouse.move(Math.random() * 500, Math.random() * 500, { steps: 20 });
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => window.scrollBy(0, -300));

    // Use 'CAPITAL FEDERAL' as per manual inspection
    const inputLoc = await page.waitForSelector('input', { visible: true });
    if (inputLoc) {
        await inputLoc.click();
        await new Promise(r => setTimeout(r, 500));
        // Type like a human
        for (const char of 'CAPITAL FEDERAL') {
            await page.keyboard.type(char, { delay: 100 + Math.random() * 150 });
        }
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
        await page.keyboard.press('Enter');
    }

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

    // Click "Pago de Facturas"
    await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const pagoFacturas = (elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas') as HTMLElement);
        if (pagoFacturas) {
            pagoFacturas.click();
        }
    });

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));

    // Search for company
    const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
    if (companyInput) {
        await companyInput.click();
        await new Promise(r => setTimeout(r, 400));
        for (const char of 'AGIP') {
            await page.keyboard.type(char, { delay: 150 + Math.random() * 100 });
        }
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 500));

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
    await new Promise(r => setTimeout(r, 1500));

    await page.waitForFunction(() => document.body.innerText.includes('COBRANZA SIN FACTURA'), { timeout: 20000 });

    // Select Service Option logic - INPUT SEARCH
    console.log('[ABL Rapipago] selecting service option...');

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
        console.log('[ABL Rapipago] ✅ Service option selected');
        // Move mouse to selection as well
        await page.mouse.move(selectionResult.x || 0, selectionResult.y || 0, { steps: 10 });
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
    // 4. Input Partida (MODO HUMANO)
    // ---------------------------------------------------------
    await new Promise(r => setTimeout(r, 2000));
    console.log('[ABL Rapipago] ✍️  Escribiendo partida modo humano...');

    const inputSelector = 'input[placeholder*="partida" i]';
    const inputPartida = await page.waitForSelector(inputSelector, {
        visible: true,
        timeout: 10000
    });

    if (inputPartida) {
        // A. Asegurar foco y limpiar (MODO HUMANO SUGERIDO BY USER)
        await inputPartida.click();
        await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLInputElement;
            if (el) el.value = '';
        }, inputSelector);

        await new Promise(r => setTimeout(r, 500));

        // B. Escribir con delay variable (entre 120ms y 250ms por tecla)
        await inputPartida.type(partida, { delay: 150 });

        // C. Mover el mouse un poco aleatoriamente (Fake mouse movements)
        await page.mouse.move(100, 100);
        await page.mouse.move(Math.floor(Math.random() * 500), Math.floor(Math.random() * 500));

        // D. Sacar el foco del input (simula que el usuario terminó de escribir)
        await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLInputElement;
            if (el) {
                el.blur();
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, inputSelector);

        // E. Espera "psicológica" antes de continuar (1.5 segundos)
        await new Promise(r => setTimeout(r, 1500));
        console.log(`[ABL Rapipago] Entered partida: ${partida} (User suggested flow)`);
    } else {
        throw new Error('Partida input not found');
    }

    // Continuar - User suggested flow
    console.log('[ABL Rapipago] Looking for Continuar button...');

    const btnContinuar = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null) as any;

    if (btnContinuar) {
        const isDisabled = await page.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'), btnContinuar);

        if (!isDisabled) {
            await btnContinuar.click();
            console.log('[ABL Rapipago] Clicked Continuar (User method)');
        } else {
            console.error('[ABL Rapipago] ⛔ El botón Continuar sigue deshabilitado. Falló la validación del input.');
            // Force one more try
            await new Promise(r => setTimeout(r, 2000));
            await btnContinuar.click();
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
            await page.screenshot({ path: 'scripts/abl-unknown-status.png', fullPage: true });
            const finalHtml = await page.content();
            const fs = require('fs');
            fs.writeFileSync('scripts/abl-unknown-status.html', finalHtml);
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
        if (page && !page.isClosed()) await page.screenshot({ path: 'scripts/abl-rapipago-error-final.png' });
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

// EXECUTE
checkABLRapipago(PARTIDA).then(res => console.log('FINAL:', res));
