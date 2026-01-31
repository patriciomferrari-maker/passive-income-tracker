import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { solveAudioCaptcha } from '../lib/utils/captcha-solver';

async function testAGIPDirect(partida: string) {
    console.log(`🚀 Starting Direct AGIP ABL Test for partida: ${partida}`);

    const browser = await puppeteer.launch({
        headless: false, // Set to false to see the interaction
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    }) as unknown as Browser;

    try {
        const page = await browser.newPage();

        // 1. Navigate to AGIP
        console.log('1️⃣  Navigating to AGIP ABL Portal...');
        await page.goto('https://lb.agip.gob.ar/ConsultaABL/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // 2. Fill Partida (twice)
        console.log('2️⃣  Filling Partida inputs...');
        const inputs = await page.$$('input[type="text"], input:not([type])');
        // Based on the image, the first two are usually the partida inputs

        if (inputs.length >= 2) {
            await inputs[0].type(partida, { delay: 100 });
            await new Promise(r => setTimeout(r, 500));
            await inputs[1].type(partida, { delay: 100 });
        } else {
            console.log('⚠️  Could not find enough inputs by generic selector, trying by ID or placeholder...');
            // In case they have specific IDs or roles
            await page.type('input[placeholder*="Partida" i], #partida', partida, { delay: 100 });
        }

        // 3. Handle CAPTCHA
        console.log('3️⃣  Analyzing CAPTCHA...');
        await new Promise(r => setTimeout(r, 2000));

        // Find reCAPTCHA iframe
        const frames = page.frames();
        const recaptchaFrame = frames.find(f => f.url().includes('google.com/recaptcha/api2/anchor'));

        if (recaptchaFrame) {
            console.log('✅ Found reCAPTCHA anchor frame.');

            // Try to click "I am not a robot"
            const checkbox = await recaptchaFrame.waitForSelector('#recaptcha-anchor', { visible: true, timeout: 5000 }).catch(() => null);
            if (checkbox) {
                console.log('   Clicking checkbox...');
                await checkbox.click();
                await new Promise(r => setTimeout(r, 3000));
            }
        } else {
            console.log('⚠️  reCAPTCHA frame not found. It might be invisible or not loaded.');
        }

        console.log('🔭 Capture high-level state of the page...');
        await page.screenshot({ path: 'scripts/debug-agip-captcha.png' });

        // 4. Click Consultar
        console.log('4️⃣  Trying to click "Consultar"...');
        const btnConsultar = await page.waitForSelector('button[type="submit"], input[type="submit"], button::-p-text(Consultar)', { timeout: 5000 }).catch(() => null) as any;

        if (btnConsultar) {
            const isDisabled = await page.evaluate(el => el.hasAttribute('disabled') || el.classList.contains('disabled'), btnConsultar);
            if (isDisabled) {
                console.log('⚠️  Button is disabled. CAPTCHA likely unsolved.');
            } else {
                console.log('🚀 Clicking Consultar!');
                await btnConsultar.click();

                // Wait for the results container or table
                console.log('⏳ Waiting for results table...');
                await page.waitForSelector('.table, table, .impresion-boletas', { timeout: 15000 }).catch(() => null);
                await new Promise(r => setTimeout(r, 2000));

                await page.screenshot({ path: 'scripts/debug-agip-results.png' });

                const data = await page.evaluate(() => {
                    const results: any[] = [];

                    // Try different selectors for the table
                    const table = document.querySelector('table') || document.querySelector('.table');
                    if (table) {
                        const rows = Array.from(table.querySelectorAll('tr'));
                        rows.forEach(row => {
                            const cols = Array.from(row.querySelectorAll('td, th'));
                            if (cols.length >= 5) {
                                results.push({
                                    año: cols[0].innerText.trim(),
                                    cuota: cols[1].innerText.trim(),
                                    vencimiento: cols[2].innerText.trim(),
                                    concepto: cols[3].innerText.trim(),
                                    importe: cols[4].innerText.trim(),
                                    importeAct: cols[5]?.innerText.trim() || ''
                                });
                            }
                        });
                    }

                    const bodyText = document.body.innerText;
                    const paymentCode = bodyText.match(/Código de pago LINK \/ BANELCO: ([\d-]+)/)?.[1];
                    const debuggingHtml = document.querySelector('.impresion-boletas')?.outerHTML || 'Table not found';

                    return { installments: results, paymentCode, debuggingHtml: debuggingHtml.substring(0, 1000) };
                });

                console.log('📊 Extracted Data:');
                console.log(`Payment Code: ${data.paymentCode || 'Not found'}`);

                // Filter out the header row
                const debtInstallments = data.installments.filter(inst => inst.año !== 'Año');

                console.log(`Installments found (excluding header): ${debtInstallments.length}`);
                // Check if we are blocked
                const isBlocked = await page.evaluate(() => {
                    const iframes = Array.from(document.querySelectorAll('iframe'));
                    return iframes.some(f => f.title?.toLowerCase().includes('reto') || f.src.includes('api2/bframe'));
                });

                if (isBlocked) {
                    console.log('❌ Status: BLOCKED by reCAPTCHA image challenge. Attempting audio solve...');
                    const solved = await solveAudioCaptcha(page);
                    if (solved) {
                        console.log('✅ Status: SOLVED via audio challenge. Re-running extraction...');
                        // After solving, we might need to click Consultar again or just wait
                        await page.waitForSelector('.table, table, .impresion-boletas', { timeout: 10000 });
                        // Re-run extraction (simplified for test script)
                        console.log('📊 Re-extracting Data...');
                        // ... rest of logic or just suggest re-running script
                    } else {
                        console.log('❌ Status: FAILED to solve via audio challenge.');
                    }
                } else if (debtInstallments.length === 0) {
                    console.log('✅ Status: UP_TO_DATE (No pending installments found)');
                } else {
                    console.log('⚠️  Status: OVERDUE (Debt detected)');
                    console.log(JSON.stringify(debtInstallments, null, 2));

                    // Calculate total
                    const total = debtInstallments.reduce((sum, inst) => {
                        let amount = inst.importe.replace('$', '').replace(/\./g, '').replace(',', '.').trim();
                        return sum + (parseFloat(amount) || 0);
                    }, 0);
                    console.log(`💰 Total Estimated Debt: $${total.toLocaleString('es-AR')}`);
                }
            }
        } else {
            console.log('❌ Consultar button not found.');
        }

    } catch (error: any) {
        console.error('❌ Error during test:', error.message);
    } finally {
        // Keep browser open for a bit to see if we reached the end or wait for manual intervention if needed
        console.log('⌛ Waiting 30s before closing browser...');
        await new Promise(r => setTimeout(r, 30000));
        await browser.close();
    }
}

const PARTIDA = process.argv[2] || '3786683';
testAGIPDirect(PARTIDA);
