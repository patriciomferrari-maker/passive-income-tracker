import puppeteer from 'puppeteer';

const ACCOUNT_TO_TEST = '2249156';

async function debugAysa() {
    console.log('🐞 Starting AYSA Debug Script (Robust Mode)...');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox']
    });

    try {
        const page = await browser.newPage();

        console.log('Navigating...');
        await page.goto('https://oficinavirtual.web.aysa.com.ar/index.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('Waiting 3 seconds...');
        await new Promise(r => setTimeout(r, 3000));

        // 1. Click "Sin Registrarte" button
        console.log('Looking for start button...');
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
            console.log('✅ Start button clicked.');
        } else {
            console.error('❌ Start button not found.');
            return;
        }

        // 2. Wait for inputs
        console.log('Waiting for inputs...');
        try {
            await page.waitForSelector('input', { timeout: 15000 });
        } catch (e) {
            console.error('❌ Timeout waiting for inputs.');
            return;
        }

        // 3. Fill form (using type for reliability)
        console.log('Filling form...');
        const inputs = await page.$$('input');
        if (inputs.length >= 3) {
            // Account
            await inputs[0].click();
            await inputs[0].type(ACCOUNT_TO_TEST);

            // Email
            await inputs[1].click();
            await inputs[1].type('prueba@gmail.com');

            // Confirm Email
            await inputs[2].click();
            await inputs[2].type('prueba@gmail.com');
        } else {
            console.error(`❌ Found only ${inputs.length} inputs, expected at least 3.`);
            return;
        }

        console.log('✅ Form filled. Waiting 1 second...');
        await new Promise(r => setTimeout(r, 1000));

        // 4. Submit
        console.log('Looking for submit button...');
        // Re-fetch buttons as DOM might have changed/updated
        const submitButtons = await page.$$('button');
        let submitBtn;

        for (const btn of submitButtons) {
            const text = await btn.evaluate(el => el.textContent || '');
            const textUpper = text.toUpperCase();
            if (textUpper.includes('CONFIRMAR') || textUpper.includes('INGRESAR')) {
                // Check if visible/enabled
                const disabled = await btn.evaluate(el => el.hasAttribute('disabled'));
                if (!disabled) {
                    submitBtn = btn;
                    break;
                }
            }
        }

        if (submitBtn) {
            await submitBtn.click();
            console.log('✅ Submit button clicked!');
        } else {
            console.error('❌ Submit button not found or disabled.');
            return;
        }

        console.log('⏳ Waiting 60 seconds for results...');
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error('❌ Unknown Error:', error);
    } finally {
        await browser.close();
    }
}

debugAysa();
