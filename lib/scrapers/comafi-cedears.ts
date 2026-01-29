// import puppeteer from 'puppeteer-extra';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// puppeteer.use(StealthPlugin());

export interface ComafiAsset {
    ticker: string;
    name: string;
    ratio: string;
    type: 'CEDEAR' | 'ETF';
}

export async function scrapeComafiCedears(): Promise<ComafiAsset[]> {
    const puppeteer = (await import('puppeteer-extra')).default;
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    puppeteer.use(StealthPlugin());

    const browser = await (puppeteer as any).launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    const assets: ComafiAsset[] = [];

    try {
        console.log('🏛️ [Comafi] Navigating to Comafi Programs page...');
        await page.goto('https://www.comafi.com.ar/custodiaglobal/programas.aspx#TTE', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for the tables to be present
        await page.waitForSelector('#programas', { timeout: 10000 });
        console.log('🏛️ [Comafi] Page loaded, extracting data...');

        // 1. Scrape Shares (CEDEARs)
        const shares = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#programas tr.trLink'));
            return rows.map(row => {
                const ticker = row.querySelector('.col-1')?.textContent?.trim() || '';
                const name = row.querySelector('.col-5')?.textContent?.trim() || '';
                const ratio = row.querySelector('.col-8')?.textContent?.trim() || '';
                return { ticker, name, ratio };
            }).filter(a => a.ticker && a.ratio);
        });
        shares.forEach(s => assets.push({ ...s, type: 'CEDEAR' }));
        console.log(`🏛️ [Comafi] Extracted ${shares.length} Shares.`);

        // 2. Scrape ETFs
        // The ETFs table is already in the DOM but might be hidden visually, evaluate should work fine.
        const etfs = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#etfs tr.trLink'));
            return rows.map(row => {
                const ticker = row.querySelector('.col-1')?.textContent?.trim() || '';
                const name = row.querySelector('.col-5')?.textContent?.trim() || '';
                const ratio = row.querySelector('.col-8')?.textContent?.trim() || '';
                return { ticker, name, ratio };
            }).filter(a => a.ticker && a.ratio);
        });
        etfs.forEach(e => assets.push({ ...e, type: 'ETF' }));
        console.log(`🏛️ [Comafi] Extracted ${etfs.length} ETFs.`);

    } catch (e: any) {
        console.error('🏛️ [Comafi] Error scraping Comafi:', e.message);
        throw e;
    } finally {
        await browser.close();
    }

    return assets;
}
