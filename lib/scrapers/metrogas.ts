
import { getBrowser } from '@/app/lib/browser-helper';
import { Page } from 'puppeteer-core'; // Import explicit types

export interface MetrogasResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkMetrogas(clientNumber: string): Promise<MetrogasResult> {
    let browser;

    try {
        console.log(`[Metrogas] Checking account: ${clientNumber}`);

        browser = await getBrowser(); // Use helper

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to Metrogas portal
        await page.goto('https://saldos.micuenta.metrogas.com.ar/', {
            waitUntil: 'networkidle2',
            timeout: 60000 // Increased timeout
        });

        // Wait for page to load - robustness
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enter client number
        const inputSelector = 'input';
        await page.waitForSelector(inputSelector, { timeout: 15000 });
        await page.type(inputSelector, clientNumber);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for results
        // Using wait for function instead of fixed timeout is better, but keeping timeout for simplicity + robustness
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Check for "No registra deuda" text using multiple strategies
        const statusData = await page.evaluate(() => {
            // Strategy 1: Look for the specific span with class sapMObjectNumberText
            const statusSpan = document.querySelector('.sapMObjectNumberText');
            const statusText = statusSpan?.textContent?.trim() || '';

            // Strategy 2: Look for any element containing "No registra deuda"
            const bodyText = document.body.textContent || '';
            const hasNoDebt = bodyText.includes('No registra deuda') || bodyText.toLowerCase().includes('no registra deuda');

            // Strategy 3: Look for dollar amounts
            const amountElements = Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent?.includes('$') && (el.children.length === 0 || el.tagName === 'SPAN'))
                .map(el => el.textContent?.trim() || '');

            return {
                statusText,
                bodyText: bodyText.substring(0, 500), // First 500 chars for debugging
                hasNoDebt,
                amountElements: amountElements.slice(0, 5) // First 5 for debugging
            };
        });

        console.log(`[Metrogas] Status text: "${statusData.statusText}"`);
        console.log(`[Metrogas] Has "No registra deuda": ${statusData.hasNoDebt}`);

        let result: MetrogasResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        // Check for no debt (multiple ways)
        if (statusData.statusText.includes('No registra deuda') || statusData.hasNoDebt) {
            result.status = 'UP_TO_DATE';
            result.debtAmount = 0;
            console.log(`[Metrogas] ✅ No debt found`);
        }
        // Check for debt amount in status text
        else if (statusData.statusText.match(/\$\s*[\d,.]+/)) {
            result.status = 'OVERDUE';
            const amountMatch = statusData.statusText.match(/\$\s*([\d,.]+)/);
            if (amountMatch) {
                result.debtAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
            }
            console.log(`[Metrogas] ⚠️  Debt found: $${result.debtAmount}`);
        }
        // Check for debt amount in any element
        else if (statusData.amountElements.length > 0) {
            const firstAmount = statusData.amountElements[0];
            const amountMatch = firstAmount.match(/\$\s*([\d,.]+)/);
            if (amountMatch) {
                result.status = 'OVERDUE';
                result.debtAmount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));
                console.log(`[Metrogas] ⚠️  Debt found (fallback): $${result.debtAmount}`);
            } else {
                console.log(`[Metrogas] ❓ Unknown status.`);
            }
        } else {
            console.log(`[Metrogas] ❓ Unknown status.`);
        }

        return result;

    } catch (error: any) {
        console.error('[Metrogas] Error:', error.message);
        return {
            status: 'ERROR',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: error.message
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
