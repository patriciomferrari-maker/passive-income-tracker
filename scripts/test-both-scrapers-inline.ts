
// @ts-nocheck
// Self-contained test script with both scrapers inline
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ABL Scraper Function
async function checkABLRapipago(partida: string) {
    console.log(`🏛️ [ABL Rapipago] Checking partida: ${partida}`);

    let browser = null;
    let page = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation']
        });

        page = await browser.newPage();
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', { waitUntil: 'networkidle2', timeout: 60000 });

        // Human behavior
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        await page.mouse.move(Math.random() * 500, Math.random() * 500, { steps: 20 });

        // Location
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

        // Pago de Facturas
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const pagoFacturas = elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas');
            if (pagoFacturas) pagoFacturas.click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // Company
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
        if (companyInput) {
            await companyInput.click();
            await new Promise(r => setTimeout(r, 400));
            for (const char of 'AGIP') {
                await page.keyboard.type(char, { delay: 150 });
            }
            await new Promise(r => setTimeout(r, 2000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 1500));

        // Service
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
                targetInput.click();
                return { found: true };
            }
            return { found: false };
        });

        // Input Partida
        await new Promise(r => setTimeout(r, 2000));
        const inputSelector = 'input[placeholder*="partida" i]';
        const inputPartida = await page.waitForSelector(inputSelector, { visible: true, timeout: 10000 });

        if (inputPartida) {
            await inputPartida.click();
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.value = '';
            }, inputSelector);
            await new Promise(r => setTimeout(r, 500));
            await inputPartida.type(partida, { delay: 150 });
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) {
                    el.blur();
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, inputSelector);
            await new Promise(r => setTimeout(r, 1500));
        }

        // Continue
        const btnContinuar = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null);
        if (btnContinuar) {
            await btnContinuar.click();
        } else {
            await page.keyboard.press('Enter');
        }

        // Results
        await new Promise(r => setTimeout(r, 8000));

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();
            const noDebt = ['no registra deuda', 'sin deuda', 'saldo cancelado'].some(t => lowerBody.includes(t));
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
            return { noDebt, totalAmount };
        });

        await browser.close();

        if (result.totalAmount > 0) {
            return { status: 'OVERDUE', debtAmount: result.totalAmount };
        } else {
            return { status: 'UP_TO_DATE', debtAmount: 0 };
        }

    } catch (error) {
        if (browser) await browser.close();
        return { status: 'ERROR', debtAmount: 0, errorMessage: error.message };
    }
}

// Naturgy Scraper Function
async function checkNaturgyRapipago(barcode: string) {
    console.log(`🔥 [Naturgy Rapipago] Checking Barcode: ${barcode}`);

    let browser = null;
    let page = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation']
        });

        page = await browser.newPage();
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', { waitUntil: 'networkidle2', timeout: 60000 });

        // Human behavior
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        await page.mouse.move(Math.random() * 500, Math.random() * 500, { steps: 20 });

        // Location
        const inputLoc = await page.waitForSelector('input', { visible: true });
        if (inputLoc) {
            await inputLoc.click();
            await new Promise(r => setTimeout(r, 500));
            for (const char of 'BUENOS AIRES') {
                await page.keyboard.type(char, { delay: 100 + Math.random() * 150 });
            }
            await new Promise(r => setTimeout(r, 1000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 2000));

        // Pago de Facturas
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const pagoFacturas = elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas');
            if (pagoFacturas) pagoFacturas.click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // Company
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
        if (companyInput) {
            await companyInput.click();
            await new Promise(r => setTimeout(r, 400));
            for (const char of 'NATURGY') {
                await page.keyboard.type(char, { delay: 150 });
            }
            await new Promise(r => setTimeout(r, 2000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 3000));

        // Service
        const selectionResult = await page.evaluate(() => {
            const textToFind = 'CODIGO DE BARRA';
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));
            const targetInput = inputs.find(input => {
                const parentSibling = input.parentElement?.nextElementSibling;
                if (parentSibling && parentSibling.textContent?.toUpperCase().includes(textToFind)) return true;
                let parent = input.parentElement;
                while (parent && parent.tagName !== 'LI' && parent.tagName !== 'BODY') {
                    if (parent.innerText && parent.innerText.toUpperCase().includes(textToFind)) return true;
                    parent = parent.parentElement;
                }
                return false;
            });
            if (targetInput) {
                targetInput.click();
                return { found: true };
            }
            return { found: false };
        });

        await new Promise(r => setTimeout(r, 2000));

        // Input Barcode
        const inputSelector = 'input[placeholder*="barra" i], input[placeholder*="código" i], input[placeholder*="cliente" i]';
        let inputClient = await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 }).catch(() => null);

        if (!inputClient) {
            const btnContinueService = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null);
            if (btnContinueService) {
                await btnContinueService.click();
                await new Promise(r => setTimeout(r, 3000));
                inputClient = await page.waitForSelector('input:not([type="checkbox"]):not([type="radio"])', { visible: true, timeout: 10000 }).catch(() => null);
            }
        }

        if (inputClient) {
            await inputClient.click();
            await page.evaluate((el) => el.value = '', inputClient);
            await new Promise(r => setTimeout(r, 500));
            await inputClient.type(barcode, { delay: 100 });
            await page.evaluate((el) => {
                el.blur();
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, inputClient);
            await new Promise(r => setTimeout(r, 1500));
        } else {
            throw new Error('Barcode input not found');
        }

        // Submit
        const btnContinuar = await page.waitForSelector('button::-p-text(Continuar)', { visible: true, timeout: 5000 }).catch(() => null);
        if (btnContinuar) {
            await btnContinuar.click();
        } else {
            await page.keyboard.press('Enter');
        }

        // Results
        await new Promise(r => setTimeout(r, 8000));

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const lowerBody = bodyText.toLowerCase();
            const noDebt = ['no registra deuda', 'sin deuda', 'saldo cancelado'].some(t => lowerBody.includes(t));
            let totalAmount = 0;
            const aPagarMatch = bodyText.match(/A\s+pagar\s+([\d,.]+)/i);
            if (aPagarMatch) {
                let clean = aPagarMatch[1].trim();
                if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/\./g, '').replace(',', '.');
                else if (clean.includes(',')) clean = clean.replace(',', '.');
                totalAmount = parseFloat(clean) || 0;
            }
            return { noDebt, totalAmount };
        });

        await browser.close();

        if (result.totalAmount > 0) {
            return { status: 'OVERDUE', debtAmount: result.totalAmount };
        } else {
            return { status: 'UP_TO_DATE', debtAmount: 0 };
        }

    } catch (error) {
        if (browser) await browser.close();
        return { status: 'ERROR', debtAmount: 0, errorMessage: error.message };
    }
}

// Main Test
async function testBothScrapers() {
    console.log('='.repeat(60));
    console.log('🧪 Testing Both Rapipago Scrapers');
    console.log('='.repeat(60));

    // Test 1: ABL CABA
    console.log('\n📋 Test 1: ABL CABA');
    console.log('-'.repeat(60));
    try {
        const ablResult = await checkABLRapipago('3786683');
        console.log('✅ ABL Result:', JSON.stringify(ablResult, null, 2));
    } catch (error) {
        console.error('❌ ABL Error:', error.message);
    }

    // Wait between tests
    console.log('\n⏳ Waiting 5 seconds before next test...\n');
    await new Promise(r => setTimeout(r, 5000));

    // Test 2: Naturgy
    console.log('📋 Test 2: Naturgy');
    console.log('-'.repeat(60));
    try {
        const naturgyResult = await checkNaturgyRapipago('32910271685513524055282506027012600015596344');
        console.log('✅ Naturgy Result:', JSON.stringify(naturgyResult, null, 2));
    } catch (error) {
        console.error('❌ Naturgy Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));
}

testBothScrapers().catch(console.error);
