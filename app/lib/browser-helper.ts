
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Environment check - consider local if not in Vercel
const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

export async function getBrowser() {
    let executablePath: string | undefined;

    console.log(`[Browser] Launching... VERCEL=${process.env.VERCEL}, NODE_ENV=${process.env.NODE_ENV}`);

    if (isLocal) {
        // Local Windows Development
        if (process.platform === 'win32') {
            const fs = require('fs');
            // Try finding typical paths
            const possiblePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                process.env.LOCAL_CHROME_PATH
            ];

            for (const p of possiblePaths) {
                if (p && typeof p === 'string' && fs.existsSync(p)) {
                    executablePath = p;
                    break;
                }
            }
        } else if (process.platform === 'darwin') {
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        } else {
            executablePath = '/usr/bin/google-chrome';
        }

        if (!executablePath) {
            console.warn('[Browser] No local chrome found, trying puppeteer default...');
            // Leave undefined to let puppeteer try to find it
        }

    } else {
        // Production (Vercel / Lambda)
        try {
            console.log('[Browser] Resolving chromium executable path...');
            // Configure chromium for Vercel
            (chromium as any).setHeadlessMode = true;
            (chromium as any).setGraphicsMode = false;

            // Attempt to resolve path
            executablePath = await chromium.executablePath();
            console.log(`[Browser] Chromium path resolved to: ${executablePath}`);
        } catch (e: any) {
            console.error('Failed to get chromium executable path:', e);
            // Fallback attempt? No, usually fatal if this fails.
            throw new Error(`Failed to load chromium: ${e.message}`);
        }
    }

    try {
        return puppeteer.launch({
            args: isLocal ? ['--no-sandbox'] : [...(chromium as any).args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: isLocal ? { width: 1280, height: 800 } : (chromium as any).defaultViewport,
            executablePath: executablePath,
            headless: isLocal ? true : (chromium as any).headless,
        });
    } catch (error: any) {
        console.error('[Browser] Launch failed:', error);
        throw error;
    }
}
