
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Environment check
const isLocal = process.env.NODE_ENV === 'development';

export async function getBrowser() {
    let executablePath: string | undefined;

    if (isLocal) {
        // Local Windows Development
        if (process.platform === 'win32') {
            executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

            // Fallback for Edge if Chrome not found (optional, but good for robustness)
            // You might want to verify if files exist, but hardcoded common paths usually suffice for dev.
            if (process.env.LOCAL_CHROME_PATH) {
                executablePath = process.env.LOCAL_CHROME_PATH;
            }
        } else if (process.platform === 'darwin') {
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else {
            executablePath = '/usr/bin/google-chrome';
        }
    } else {
        // Production (Vercel / Lambda)
        try {
            // @sparticuz/chromium requires this to locate the binary in the serverless env
            executablePath = await chromium.executablePath();
        } catch (e) {
            console.error('Failed to get chromium executable path:', e);
            throw e;
        }
    }

    console.log(`[Browser] Launching. Local: ${isLocal}, Path: ${executablePath}`);

    return puppeteer.launch({
        args: isLocal ? ['--no-sandbox'] : [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: isLocal ? { width: 1280, height: 800 } : chromium.defaultViewport,
        executablePath: executablePath,
        headless: isLocal ? false : chromium.headless, // Headless true in prod
        ignoreHTTPSErrors: true,
    });
}
