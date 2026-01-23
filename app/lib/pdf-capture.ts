import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Cache browser instance check
let isLocal = process.env.NODE_ENV === 'development';

export async function generateDashboardPdf(userId: string, type: 'rentals' | 'investments' | 'dashboard' | 'finance' | 'bank' | 'debts' | 'services', baseUrl: string, secret: string, queryParams?: Record<string, string>): Promise<Buffer> {
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
        let executablePath: string | undefined;

        if (isLocal) {
            if (process.platform === 'win32') {
                executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            } else if (process.platform === 'darwin') {
                executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else {
                executablePath = '/usr/bin/google-chrome';
            }
        }

        if (!executablePath) {
            executablePath = await chromium.executablePath();
        }

        console.log(`[PDF] Launching Puppeteer. Local: ${isLocal}, Platform: ${process.platform}, Path: ${executablePath}`);

        browser = await puppeteer.launch({
            args: isLocal ? ['--no-sandbox'] : chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath || undefined,
            headless: chromium.headless,
        });
    }

    try {
        const page = await browser.newPage();

        // CLAVE 1: Definir un Viewport grande para que el layout no se rompa
        await page.setViewport({
            width: 1280, // Suficiente para gráficos de 1000px y 480px
            height: 800,
            deviceScaleFactor: 2, // Mejora la nitidez de textos y SVG
        });

        // Pass the secret via Header (more robust) and URL (fallback)
        await page.setExtraHTTPHeaders({
            'X-Cron-Secret': secret
        });

        // FORCE DARK MODE: Activate Tailwind dark: classes
        await page.emulateMediaFeatures([
            { name: 'prefers-color-scheme', value: 'dark' }
        ]);

        // CLAVE 2: Forzar fondo negro antes de cargar
        await page.evaluate(() => {
            document.documentElement.style.background = '#020617';
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

        // EXTENDED WAIT: Ensure fonts and scripts load completely
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // CLAVE 3: Esperar a que las fuentes se carguen (evita texto genérico)
        await page.evaluateHandle('document.fonts.ready');
        await new Promise(r => setTimeout(r, 1500)); // Margen para Recharts

        // Generate PDF
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true, // MANDATORY for dark background
            landscape: true, // Rentals se ve mejor en horizontal
            displayHeaderFooter: false,
            margin: {
                top: '5mm',
                right: '5mm',
                bottom: '5mm',
                left: '5mm'
            },
            scale: 0.8 // Ajusta para que los 1000px entren en A4
        });


        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}
