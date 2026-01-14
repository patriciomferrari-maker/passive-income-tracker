import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Cache browser instance check
let isLocal = process.env.NODE_ENV === 'development';

export async function generateDashboardPdf(userId: string, type: 'rentals' | 'investments' | 'dashboard' | 'finance' | 'bank' | 'debts', baseUrl: string, secret: string, queryParams?: Record<string, string>): Promise<Buffer> {
    const isRentals = type === 'rentals';

    // Hybrid Strategy: Remote in Prod (Browserless), Local in Dev
    const browserlessToken = process.env.BROWSERLESS_TOKEN;

    let browser;

    if (browserlessToken) {
        // ... (existing)
        console.log('Connecting to Remote Browserless.io instance...');
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}&stealth`,
        });
    } else {
        // ... (existing fallback)
        let executablePath = await chromium.executablePath();

        if (isLocal && !executablePath) {
            const { platform } = process;
            // ...
            if (platform === 'win32') executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            else if (platform === 'darwin') executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            else executablePath = '/usr/bin/google-chrome';
        }

        browser = await puppeteer.launch({
            args: isLocal ? ['--no-sandbox'] : chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath || undefined,
            headless: chromium.headless,
        });
    }

    try {
        const page = await browser.newPage();

        // Pass the secret via Header (more robust) and URL (fallback)
        await page.setExtraHTTPHeaders({
            'X-Cron-Secret': secret
        });

        // Construct URL with Query Params
        const urlObj = new URL(`${baseUrl}/print/${userId}/${type}`);
        urlObj.searchParams.set('secret', secret);
        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                urlObj.searchParams.set(key, value);
            });
        }
        const url = urlObj.toString();

        // Optimize loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
                req.continue();
            } else if (resourceType === 'document' || resourceType === 'script' || resourceType === 'xhr' || resourceType === 'fetch') {
                req.continue();
            } else {
                req.abort();
            }
        });

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Generate PDF
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            landscape: isRentals, // Rentals usually landscape if it has wide tables
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });

        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}
