import puppeteer from 'puppeteer';

const PARTIDA = '3786683'; // From user screenshot

async function checkABLInteractive() {
    console.log(`[ABL] Starting interactive check for Partida: ${PARTIDA}`);
    console.log('[ABL] Launching visible browser...');
    console.log('[ABL] PLEASE SOLVE THE CAPTCHA MANUALLY WHEN THE PAGE LOADS.');

    const browser = await puppeteer.launch({
        headless: false, // Visible for user interaction
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();

        // Navigate to ABL
        await page.goto('https://lb.agip.gob.ar/ConsultaABL/', { waitUntil: 'networkidle2' });

        // Wait for input
        await page.waitForSelector('input[name="partida"]');

        // Type Partida
        await page.type('input[name="partida"]', PARTIDA);

        // Type Re-enter Partida (it seems to have a similar name or ID, let's find it)
        // Based on typical forms, I'll look for the second input or by label if possible.
        // But usually "name=partida" might be unique? The image showed "Reingrese partida".
        // Let's inspect via evaluation to be sure, OR just type in the focused elements if we can.
        // A safer bet is to wait and see what the page has.
        // For now, I'll try to find inputs by order.

        const inputs = await page.$$('input[type="text"], input[type="number"]');
        if (inputs.length >= 2) {
            await inputs[0].type(PARTIDA);
            await inputs[1].type(PARTIDA);
        } else {
            console.log('Could not find two inputs for Partida. Attempting single fill...');
            await page.type('input[name="partida"]', PARTIDA);
        }

        console.log('\n[ACTION REQUIRED] ---------------------------------------------------');
        console.log('1. Solve the reCAPTCHA manually.');
        console.log('2. Click "Consultar".');
        console.log('3. Wait for the results page to load.');
        console.log('---------------------------------------------------------------------\n');

        // Wait for navigation to result page. 
        // We detect this by looking for text like "Estado de cuenta" or specific debt table headers.
        // Or simply wait for a specific element that only appears on the result page.
        // We'll wait up to 60 seconds for the user to solve it.

        await page.waitForFunction(
            () => document.body.innerText.includes('Estado de Deuda') ||
                document.body.innerText.includes('Total a Pagar') ||
                document.body.innerText.includes('Saldo a Favor') ||
                document.body.innerText.includes('No registra deuda'),
            { timeout: 60000 }
        );

        console.log('[ABL] Results page detected! Scraping data...');

        // Give it a moment to fully render
        await new Promise(r => setTimeout(r, 2000));

        const result = await page.evaluate(() => {
            const text = document.body.innerText;
            const hasDebt = text.includes('Total a Pagar') && !text.includes('$ 0,00'); // Rough heuristic
            const amountMatch = text.match(/\$\s*([\d,.]+)/); // First price often indicates debt or total

            return {
                textPreview: text.substring(0, 500),
                hasDebt,
                amount: amountMatch ? amountMatch[1] : '0'
            };
        });

        console.log('[ABL] Scraped Data:', result);

    } catch (error) {
        console.error('[ABL] Error or Timeout:', error);
    } finally {
        console.log('[ABL] Closing browser in 10 seconds...');
        await new Promise(r => setTimeout(r, 10000));
        await browser.close();
    }
}

checkABLInteractive();
