import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function debugProntoPago(partida: string) {
    console.log(`🏛️ [DEBUG PRONTO] Checking partida: ${partida} in HEADLESS mode`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    try {
        console.log('[DEBUG PRONTO] Navigating...');
        await page.goto('https://pagos.prontopago.com.ar/#/index/withoutinvoice', { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        await page.screenshot({ path: 'scripts/debug-pronto-1.png' });

        const isLogin = await page.evaluate(() => document.body.innerText.includes('Continuar sin usuario'));
        if (isLogin) {
            console.log('[DEBUG PRONTO] Clicking Continuar sin usuario...');
            await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('div, span, h6, p'));
                const target = elements.find(el => el.textContent?.trim() === 'Continuar sin usuario');
                if (target) (target as any).click();
            });
            await new Promise(r => setTimeout(r, 4000));
        }

        console.log('[DEBUG PRONTO] Searching for patentes...');
        const searchInput = await page.waitForSelector('input', { timeout: 15000 });
        await searchInput.type('patentes');
        await new Promise(r => setTimeout(r, 4000));

        console.log('[DEBUG PRONTO] Selecting AGIP...');
        const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('mat-option, div.mat-list-item, span'));
            const target = elements.find(el => el.textContent?.includes('AGIP GCBA - ABL IIBB PATENTES'));
            if (target) {
                (target as any).click();
                return true;
            }
            return false;
        });
        console.log('[DEBUG PRONTO] Clicked result:', clicked);
        await new Promise(r => setTimeout(r, 4000));
        await page.screenshot({ path: 'scripts/debug-pronto-2.png' });

        console.log('[DEBUG PRONTO] Selecting Plan de Facilidades...');
        await page.evaluate(() => {
            const trigger = document.querySelector('.mat-select-trigger');
            if (trigger) (trigger as any).click();
        });
        await new Promise(r => setTimeout(r, 2000));

        const optionClicked = await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('span, mat-option, div[role="option"]'));
            const target = options.find(el => el.textContent?.includes('COBRANZA SIN FACTURA - PLAN DE FACILIDADES'));
            if (target) {
                (target as any).click();
                return true;
            }
            return false;
        });
        console.log('[DEBUG PRONTO] Option clicked result:', optionClicked);
        await new Promise(r => setTimeout(r, 4000));
        await page.screenshot({ path: 'scripts/debug-pronto-3.png' });

        console.log('[DEBUG PRONTO] Entering partida...');
        const partidaInput = await page.waitForSelector('input[data-placeholder*="partida"], input[id*="mat-input"]', { timeout: 5000 });
        await partidaInput.type(partida);
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 8000));

        await page.screenshot({ path: 'scripts/debug-pronto-4-final.png' });
        const result = await page.evaluate(() => document.body.innerText.substring(0, 500));
        console.log('[DEBUG PRONTO] Final text:', result);

    } catch (e) {
        console.error('[DEBUG PRONTO] Error:', e.message);
        await page.screenshot({ path: 'scripts/debug-pronto-error.png' });
    } finally {
        await browser.close();
    }
}

debugProntoPago('3786683');
