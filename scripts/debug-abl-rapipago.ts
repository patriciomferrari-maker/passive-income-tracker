
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';

// Add stealth plugin
puppeteer.use(StealthPlugin());

async function debugABL() {
    const partida = '3786683';
    console.log('🚀 Debugging ABL CABA (Rapipago)...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    }) as unknown as Browser;

    const page = await browser.newPage();
    try {
        console.log('Navigating to Rapipago...');
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', { waitUntil: 'networkidle2' });

        console.log('Selecting location...');
        const inputLoc = await page.waitForSelector('input', { visible: true });
        if (inputLoc) {
            await inputLoc.click();
            await page.keyboard.type('CAPITAL FEDERAL');
            await new Promise(r => setTimeout(r, 2000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        console.log('Selecting Pago de Facturas...');
        await new Promise(r => setTimeout(r, 3000));
        await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('*')).find(x => x.textContent?.toLowerCase() === 'pago de facturas') as HTMLElement;
            if (el) el.click();
        });

        console.log('Searching AGIP...');
        await new Promise(r => setTimeout(r, 3000));
        const companyInput = await page.waitForSelector('input[placeholder*="empresa" i]', { timeout: 10000 });
        if (companyInput) {
            await companyInput.type('AGIP');
            await new Promise(r => setTimeout(r, 3000));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }

        console.log('Waiting for service selection screen...');
        await new Promise(r => setTimeout(r, 10000));

        await page.screenshot({ path: 'scripts/debug-abl-services.png', fullPage: true });
        const bodyText = await page.evaluate(() => document.body.innerText);
        fs.writeFileSync('scripts/debug-abl-services.txt', bodyText);
        console.log('Screenshot and body text saved.');

    } catch (e: any) {
        console.error('Error:', e.message);
        await page.screenshot({ path: 'scripts/debug-abl-error.png' });
    } finally {
        await browser.close();
    }
}

debugABL().catch(e => console.error(e));
