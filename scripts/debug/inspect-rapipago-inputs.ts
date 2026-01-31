
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', { waitUntil: 'networkidle2' });

        // Select Capital
        console.log('Selecting Province...');
        await page.waitForSelector('input');
        await page.keyboard.type('CAPITAL FEDERAL');
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));

        // Click Pago de Facturas
        console.log('Clicking Pago de Facturas...');
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent?.toLowerCase().includes('pago de facturas')) as HTMLElement;
            if (el) el.click();
        });
        await new Promise(r => setTimeout(r, 3000));

        // Search AGIP
        console.log('Searching AGIP...');
        await page.waitForSelector('input');
        await page.keyboard.type('AGIP');
        await new Promise(r => setTimeout(r, 2000));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));

        // Select Sin Factura
        console.log('Selecting Sin Factura...');
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('li')).find(e => e.textContent?.includes('COBRANZA SIN FACTURA'));
            if (el) {
                const input = el.querySelector('input');
                if (input) input.click();
            }
        });

        // WAIT FOR PARTIDA INPUT
        console.log('Waiting for Partida input...');
        await page.waitForSelector('input[placeholder*="partida" i], input[formcontrolname="nroPartida"]', { timeout: 10000 });

        // Inspect inputs
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(input => ({
                id: input.id,
                name: input.name,
                placeholder: input.placeholder,
                type: input.type,
                formcontrolname: input.getAttribute('formcontrolname'),
                outerHTML: input.outerHTML
            }));
        });

        console.log('Inputs found at Partida page:', JSON.stringify(inputs, null, 2));

    } catch (e) {
        console.error('Error during inspection:', e);
        try {
            await page.screenshot({ path: 'inspect-error.png' });
        } catch (s) { }
    } finally {
        await browser.close();
    }
})();
