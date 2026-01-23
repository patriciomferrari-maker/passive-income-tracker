import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

export interface ABLResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

const BOTI_NAME = 'Boti';
const BOTI_NUMBER = '+54 9 11 5050-0147';
const SESSION_PATH = path.join(process.cwd(), '.whatsapp-session');

export async function checkABLWhatsAppDirect(partida: string): Promise<ABLResult> {
    console.log(`[ABL Direct] Checking Partida: ${partida} via WhatsApp Web`);

    if (!fs.existsSync(SESSION_PATH)) {
        fs.mkdirSync(SESSION_PATH, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: SESSION_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        defaultViewport: null
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });

        console.log('[ABL Direct] Waiting for WhatsApp to load...');
        try {
            await page.waitForSelector('#pane-side', { timeout: 45000 });
            console.log('[ABL Direct] Logged in successfully!');
        } catch (e) {
            console.log('\n[ABL Direct] NOT LOGGED IN. Please scan QR Code in the browser window.\n');
            await page.waitForSelector('#pane-side', { timeout: 0 });
            console.log('[ABL Direct] Logged in successfully!');
        }

        await new Promise(r => setTimeout(r, 5000));

        console.log(`[ABL Direct] Searching for ${BOTI_NAME}...`);
        const searchSelector = 'div[contenteditable="true"][data-tab="3"]';

        let searchBox = await page.$(searchSelector);
        if (!searchBox) {
            // Try searching generic content editable if specific tab selector fails
            const editables = await page.$$('div[contenteditable="true"]');
            if (editables.length > 0) searchBox = editables[0];
        }

        if (searchBox) {
            await searchBox.click();
            // Clear it first just in case
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');

            await searchBox.type(BOTI_NUMBER);
            await new Promise(r => setTimeout(r, 2500));
            await page.keyboard.press('Enter');
        } else {
            throw new Error('Could not find search box');
        }

        console.log('[ABL Direct] Chat opened. Sending commands...');
        await new Promise(r => setTimeout(r, 3000));

        const messageSelector = 'div[contenteditable="true"][data-tab="10"]';
        await page.waitForSelector(messageSelector);

        async function sendMessage(text: string) {
            await page.type(messageSelector, text);
            await new Promise(r => setTimeout(r, 500));
            await page.keyboard.press('Enter');
        }

        // --- NEW FLOW ---
        // 1. Hola
        await sendMessage('Hola');
        console.log('[ABL Direct] Sent: Hola');
        await new Promise(r => setTimeout(r, 3000));

        // 2. Consultar deuda ABL
        await sendMessage('Consultar deuda ABL');
        console.log('[ABL Direct] Sent: Consultar deuda ABL');
        await new Promise(r => setTimeout(r, 6000));

        // 3. Partida
        await sendMessage(partida);
        console.log(`[ABL Direct] Sent Partida: ${partida}`);

        console.log('[ABL Direct] Waiting for results...');
        await new Promise(r => setTimeout(r, 10000));

        // Scrape responses
        const messages = await page.evaluate(() => {
            const msgElements = document.querySelectorAll('div.message-in span.selectable-text');
            return Array.from(msgElements).map(el => el.textContent || '').filter(t => t.length > 5);
        });

        const lastMessages = messages.slice(-5);
        console.log('[ABL Direct] Recent responses:', lastMessages);

        const combinedText = lastMessages.join(' ').toLowerCase();
        let result: ABLResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (combinedText.includes('no tenés deuda') || combinedText.includes('al día') || combinedText.includes('no registra deuda')) {
            result.status = 'UP_TO_DATE';
        } else if (combinedText.includes('$')) {
            const amountMatch = combinedText.match(/\$\s*([\d,.]+)/);
            if (amountMatch) {
                result.status = 'OVERDUE';
                result.debtAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
            }
        }

        console.log(`[ABL Direct] Parsed Status: ${result.status}, Debt: ${result.debtAmount}`);
        return result;

    } catch (error: any) {
        console.error('[ABL Direct] Error:', error.message);
        return {
            status: 'ERROR',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: error.message
        };
    } finally {
        console.log('[ABL Direct] Closing browser...');
        await browser.close();
    }
}
