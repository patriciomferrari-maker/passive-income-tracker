import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Cache browser instance check
let isLocal = process.env.NODE_ENV === 'development';

export async function generateDashboardPdf(userId: string, type: 'rentals' | 'investments', baseUrl: string, secret: string): Promise<Buffer> {
    const isRentals = type === 'rentals';

    // Hybrid Strategy: Remote in Prod (Browserless), Local in Dev
    const browserlessToken = process.env.BROWSERLESS_TOKEN;

    let browser;

    if (browserlessToken) {
        console.log('Connecting to Remote Browserless.io instance...');
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}&stealth`,
        });
    } else {
        // Fallback to local Chrome (mostly for Dev)
        // Configure Chromium for Serverless
        // Note: In local dev, you might need a local chrome path or full puppeteer
        // This logic attempts to find a local path if we are in dev and executablePath is missing
        let executablePath = await chromium.executablePath();

        if (isLocal && !executablePath) {
            // Try common local paths or just assume the user has Chrome installed
            // If this fails locally, we might need 'puppeteer' (full) devDependency
            const { platform } = process;
            if (platform === 'win32') {
                executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            } else if (platform === 'darwin') {
                executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else {
                executablePath = '/usr/bin/google-chrome';
            }
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
        const url = `${baseUrl}/print/${userId}/${type}?secret=${encodeURIComponent(secret)}`;

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
