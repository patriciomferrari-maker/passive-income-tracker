
// @ts-nocheck
import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function debugHeadlessABL(partida: string) {
    console.log(`🏛️ [DEBUG ABL] Checking partida: ${partida} in HEADLESS mode`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    try {
        // 1. Navigate
        await page.goto('https://pagar.rapipago.com.ar/rapipagoWeb/pagos/', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'scripts/debug-abl-1-home.png' });

        // 2. Location
        const inputLoc = await page.waitForSelector('input', { visible: true });
        await inputLoc.click();
        await page.keyboard.type('CAPITAL FEDERAL', { delay: 100 });
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: 'scripts/debug-abl-2-location.png' });

        // 3. Pago de Facturas
        await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const btn = elements.find(el => el.textContent?.trim().toLowerCase() === 'pago de facturas');
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'scripts/debug-abl-3-pago.png' });

        const searchTerms = ['AGIP', 'GCBA', 'INMOBILIARIO', 'ABL'];
        for (const term of searchTerms) {
            console.log(`[DEBUG ABL] Searching for term: ${term}`);
            const companyInput = await page.waitForSelector('input[placeholder*="empresa" i], input[type="text"]', { visible: true });
            if (!companyInput) { console.log(`[DEBUG ABL] Could not find input for term ${term}`); continue; }
            await page.evaluate((el) => { if (el) el.value = ''; }, companyInput);
            await companyInput.focus();
            await companyInput.click();
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.keyboard.type(term, { delay: 100 });
            await new Promise(r => setTimeout(r, 4000));

            const dropdownData = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('[id^="react-select-"], li, div[role="option"]'));
                return [...new Set(items.map(el => el.textContent?.trim()).filter(Boolean))];
            });
            console.log(`[DEBUG ABL] Results for ${term}:`, dropdownData);
            await page.screenshot({ path: `scripts/debug-abl-search-${term}.png` });
        }

        // Now pick one and check services
        console.log('[DEBUG ABL] Re-selecting AGIP GCBA - ABL IIBB PATENTES to check for hidden services...');
        const finalInput = await page.waitForSelector('input[placeholder*="empresa" i]', { visible: true });
        await page.evaluate((el) => { el.value = ''; }, finalInput);
        await page.keyboard.type('AGIP', { delay: 100 });
        await new Promise(r => setTimeout(r, 3000));
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 4000));

        const services = await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('.checkbox-label, label'));
            const inputs = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"]'));
            return labels.map(l => l.textContent?.trim());
        });
        console.log('[DEBUG ABL] Final Services List:', services);
        await page.screenshot({ path: 'scripts/debug-abl-final-services.png' });
        fs.writeFileSync('scripts/debug-abl-final-dom.html', await page.content());
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'scripts/debug-abl-5-company-selected.png' });

        // 5. Service Selection
        console.log('[DEBUG ABL] listing all services...');
        const services = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.checkbox-label, label')).map(el => el.textContent?.trim()).filter(Boolean);
        });
        console.log('[DEBUG ABL] Available services:', services);

        const selection = await page.evaluate(() => {
            const textToFind = 'PLAN DE FACILIDADES'; // Be specific
            const labels = Array.from(document.querySelectorAll('label, .checkbox-label'));
            const targetLabel = labels.find(l => l.textContent?.includes(textToFind));
            if (targetLabel) {
                // Find associated input - usually a sibling or inside parent
                const parent = targetLabel.parentElement;
                const input = parent.querySelector('input');
                if (input) {
                    input.click();
                    return 'CLICKED_INPUT_BY_LABEL';
                }
            }
            return 'NOT_FOUND';
        });
        console.log(`[DEBUG ABL] Service selection result: ${selection}`);
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'scripts/debug-abl-6-service-clicked.png' });

        // 6. Look for Partida Input
        console.log('[DEBUG ABL] Looking for partida input...');
        const inputSelector = 'input[placeholder*="partida" i]';
        const found = await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 }).catch(() => null);

        if (!found) {
            console.log('[DEBUG ABL] ❌ Partida input NOT found. Dumping DOM and screenshot.');
            await page.screenshot({ path: 'scripts/debug-abl-failed-input.png' });
            fs.writeFileSync('scripts/debug-abl-failed.html', await page.content());
        } else {
            console.log('[DEBUG ABL] ✅ Partida input found!');
        }

    } catch (e) {
        console.error('[DEBUG ABL] Error:', e.message);
        await page.screenshot({ path: 'scripts/debug-abl-error.png' });
    } finally {
        await browser.close();
    }
}

debugHeadlessABL('3786683');
