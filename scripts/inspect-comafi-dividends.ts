import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

async function inspectComafiDividends() {
    console.log('🔄 Starting inspection...');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('🔄 Navigating to page...');
        await page.goto('https://www.comafi.com.ar/custodiaglobal/dividendos.aspx', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content to load
        console.log('⏳ Waiting for content...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Take screenshot
        const screenshotPath = path.join(process.cwd(), 'comafi-dividends-screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

        // Get HTML content
        const html = await page.content();
        const htmlPath = path.join(process.cwd(), 'comafi-dividends.html');
        fs.writeFileSync(htmlPath, html);
        console.log(`📄 HTML saved to: ${htmlPath}`);

        // Try to find any tables
        const tables = await page.evaluate(() => {
            const allTables = document.querySelectorAll('table');
            return Array.from(allTables).map((table, idx) => ({
                index: idx,
                rows: table.querySelectorAll('tr').length,
                headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim()),
                firstRowCells: Array.from(table.querySelectorAll('tr:first-child td, tr:first-child th')).map(cell => cell.textContent?.trim())
            }));
        });

        console.log('\n📊 Tables found:', tables.length);
        tables.forEach(t => {
            console.log(`\nTable ${t.index}:`);
            console.log(`  Rows: ${t.rows}`);
            console.log(`  Headers: ${JSON.stringify(t.headers)}`);
            console.log(`  First row: ${JSON.stringify(t.firstRowCells)}`);
        });

        // Look for any divs that might contain dividend data
        const divs = await page.evaluate(() => {
            const allDivs = document.querySelectorAll('[class*="divid"], [class*="payment"], [id*="divid"], [id*="payment"]');
            return Array.from(allDivs).map(div => ({
                class: div.className,
                id: div.id,
                text: div.textContent?.trim().substring(0, 100)
            }));
        });

        console.log('\n📦 Relevant divs found:', divs.length);
        divs.slice(0, 5).forEach(d => {
            console.log(`\nDiv:`);
            console.log(`  Class: ${d.class}`);
            console.log(`  ID: ${d.id}`);
            console.log(`  Text: ${d.text}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

inspectComafiDividends().catch(console.error);
