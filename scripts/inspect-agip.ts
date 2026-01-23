
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
        console.log('Navigating to AGIP Public Query...');
        await page.goto('https://lb.agip.gob.ar/ConsultaABL/', { waitUntil: 'networkidle2', timeout: 60000 });

        const title = await page.title();
        console.log('Page Title:', title);

        await page.screenshot({ path: 'agip_query.png' });

        const content = await page.content();
        const fs = require('fs');
        fs.writeFileSync('agip_query.html', content);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
})();
