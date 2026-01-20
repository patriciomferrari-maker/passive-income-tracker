import puppeteer from 'puppeteer';

export interface ABLCABAResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkABLCABA(partidaNumber: string): Promise<ABLCABAResult> {
    let browser;

    try {
        console.log(`[ABL CABA] Checking partida: ${partidaNumber}`);

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to AGIP ABL portal
        await page.goto('https://lb.agip.gob.ar/ConsultaABL/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enter partida number
        await page.waitForSelector('input[name="partida"]', { timeout: 10000 });
        await page.type('input[name="partida"]', partidaNumber);

        // Submit form
        await page.click('button[type="submit"], input[type="submit"]');

        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check for debt information
        const debtInfo = await page.evaluate(() => {
            const bodyText = document.body.textContent || '';

            // Look for debt indicators
            const hasDebt = bodyText.includes('deuda') || bodyText.includes('vencido') || bodyText.includes('pendiente');
            const noDebt = bodyText.includes('sin deuda') || bodyText.includes('al día') || bodyText.includes('no registra deuda');

            // Try to find amount
            const amountMatch = bodyText.match(/\$\s*([\d,.]+)/);
            const amount = amountMatch ? amountMatch[1] : null;

            return {
                bodyText: bodyText.substring(0, 500),
                hasDebt,
                noDebt,
                amount
            };
        });

        console.log(`[ABL CABA] Has debt: ${debtInfo.hasDebt}, No debt: ${debtInfo.noDebt}`);

        let result: ABLCABAResult = {
            status: 'UNKNOWN',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (debtInfo.noDebt) {
            result.status = 'UP_TO_DATE';
            result.debtAmount = 0;
            console.log(`[ABL CABA] ✅ No debt found`);
        } else if (debtInfo.hasDebt && debtInfo.amount) {
            result.status = 'OVERDUE';
            result.debtAmount = parseFloat(debtInfo.amount.replace(/\./g, '').replace(',', '.'));
            console.log(`[ABL CABA] ⚠️  Debt found: $${result.debtAmount}`);
        } else {
            console.log(`[ABL CABA] ❓ Unknown status`);
        }

        return result;

    } catch (error: any) {
        console.error('[ABL CABA] Error:', error.message);
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
