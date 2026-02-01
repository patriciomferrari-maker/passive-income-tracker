
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Environment check - consider local if not in Vercel
const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

export async function getBrowser() {
    let executablePath: string | undefined;

    if (isLocal) {
        // Local Windows Development
        if (process.platform === 'win32') {
            // First try to use puppeteer installed chrome
            const os = require('os');
            const path = require('path');
            const fs = require('fs');

            const puppeteerChromePath = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');

            // Check if puppeteer chrome exists
            if (fs.existsSync(puppeteerChromePath)) {
                try {
                    const versions = fs.readdirSync(puppeteerChromePath);
                    if (versions.length > 0) {
                        // Use the first version found
                        const chromePath = path.join(puppeteerChromePath, versions[0], 'chrome-win64', 'chrome.exe');
                        if (fs.existsSync(chromePath)) {
                            executablePath = chromePath;
                            console.log(`[Browser] Using Puppeteer Chrome: ${executablePath}`);
                        }
                    }
                } catch (e) {
                    console.log('[Browser] Could not read puppeteer chrome directory');
                }
            }

            // Fallback to system Chrome if puppeteer chrome not found
            if (!executablePath) {
                executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

                // Fallback for Edge if Chrome not found
                if (process.env.LOCAL_CHROME_PATH) {
                    executablePath = process.env.LOCAL_CHROME_PATH;
                }
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
        headless: true, // Always headless to prevent blocking
        ignoreHTTPSErrors: true,
    });
}
