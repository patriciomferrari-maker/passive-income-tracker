
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { solveAudioCaptcha } from '../utils/captcha-solver';

export interface ABLCABAResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

/**
 * Checks ABL CABA debt directly from the AGIP portal (lb.agip.gob.ar)
 * Uses puppeteer-extra-plugin-stealth to bypass reCAPTCHA v2.
 */
export async function checkABLCABA(partidaNumber: string): Promise<ABLCABAResult> {
    console.log(`🏛️ [ABL Direct AGIP] Checking partida: ${partidaNumber}`);

    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        }) as unknown as Browser;

        const page = await browser.newPage();

        // 1. Navigate to AGIP
        await page.goto('https://lb.agip.gob.ar/ConsultaABL/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // 2. Fill Partida (twice as required by portal)
        const inputs = await page.$$('input[type="text"], input:not([type])');
        if (inputs.length >= 2) {
            await inputs[0].type(partidaNumber, { delay: 100 });
            await new Promise(r => setTimeout(r, 500));
            await inputs[1].type(partidaNumber, { delay: 100 });
        } else {
            // Fallback to more specific selectors if generic fails
            await page.waitForSelector('input[placeholder*="Partida" i]', { timeout: 5000 });
            await page.type('input[placeholder*="Partida" i]', partidaNumber, { delay: 100 });
            // Re-type in the second one (usually it follows)
            const secondInput = await page.$('input:nth-of-type(2)');
            if (secondInput) await secondInput.type(partidaNumber, { delay: 100 });
        }

        // 3. Handle CAPTCHA
        await new Promise(r => setTimeout(r, 1500));
        const frames = page.frames();
        const recaptchaFrame = frames.find(f => f.url().includes('google.com/recaptcha/api2/anchor'));

        if (recaptchaFrame) {
            console.log('🏛️ [ABL Direct AGIP] Found reCAPTCHA, attempting to solve...');
            const checkbox = await recaptchaFrame.waitForSelector('#recaptcha-anchor', { visible: true, timeout: 5000 }).catch(() => null);
            if (checkbox) {
                await checkbox.click();
                await new Promise(r => setTimeout(r, 2000));

                // Check if it's already solved or if a challenge appeared
                const isSolved = await page.evaluate(() => {
                    const cb = document.querySelector('.recaptcha-checkbox[aria-checked="true"]');
                    return !!cb;
                });

                if (!isSolved) {
                    console.log('🏛️ [ABL Direct AGIP] Visual challenge detected, switching to audio...');
                    const solved = await solveAudioCaptcha(page);
                    if (solved) {
                        console.log('🏛️ [ABL Direct AGIP] Audio CAPTCHA solved successfully!');
                    } else {
                        console.warn('🏛️ [ABL Direct AGIP] Failed to solve CAPTCHA automatically.');
                    }
                } else {
                    console.log('🏛️ [ABL Direct AGIP] CAPTCHA solved automatically via checkbox.');
                }
            }
        }

        // 4. Click Consultar
        const btnConsultar = await page.waitForSelector('button[type="submit"], input[type="submit"], button::-p-text(Consultar)', { timeout: 5000 }).catch(() => null) as any;

        if (!btnConsultar) {
            throw new Error('Consultar button not found');
        }

        await btnConsultar.click();

        // 5. Wait for and Parse Results
        const resultFound = await page.waitForSelector('.table, table, .impresion-boletas, .alert, .mensaje', { timeout: 15000 }).catch(() => null);

        if (!resultFound) {
            const stillChallenged = await page.evaluate(() => {
                const iframes = Array.from(document.querySelectorAll('iframe'));
                return iframes.some(f => f.title?.toLowerCase().includes('reto') || f.src.includes('api2/bframe'));
            });
            if (stillChallenged) throw new Error('Blocked by reCAPTCHA image challenge');
            throw new Error('Timeout waiting for results page');
        }

        const data = await page.evaluate(() => {
            const installments: any[] = [];

            // 1. Check for specific "No debt" messages
            const bodyText = document.body.innerText.toLowerCase();
            const noDebtIndicators = ['no registra deuda', 'sin deuda', 'saldo cancelado', 'no existen boletas'];
            const hasNoDebtMessage = noDebtIndicators.some(t => bodyText.includes(t));

            // 2. Scan for rows in any table
            const rows = Array.from(document.querySelectorAll('tr'));
            rows.forEach(row => {
                const cols = Array.from(row.querySelectorAll('td, th'));
                if (cols.length >= 5) {
                    const yearText = cols[0].innerText.trim();
                    const amountText = cols[4].innerText.trim();
                    const amountActText = cols[5]?.innerText.trim() || '';

                    // Data row if year is 4 digits and amount has $
                    if (/^\d{4}$/.test(yearText) && (amountText.includes('$') || amountActText.includes('$'))) {
                        installments.push({
                            amount: (amountActText.includes('$') ? amountActText : amountText)
                                .replace('$', '').replace(/\./g, '').replace(',', '.').trim()
                        });
                    }
                }
            });

            return { installments, hasNoDebtMessage };
        });

        let finalResult: ABLCABAResult;

        if (data.installments.length > 0) {
            const totalDebt = data.installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
            finalResult = {
                status: 'OVERDUE',
                debtAmount: totalDebt,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else if (data.hasNoDebtMessage) {
            finalResult = {
                status: 'UP_TO_DATE',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null
            };
        } else {
            finalResult = {
                status: 'UNKNOWN',
                debtAmount: 0,
                lastBillAmount: null,
                lastBillDate: null,
                dueDate: null,
                errorMessage: 'No debt rows found but no "No Debt" confirmation either'
            };
        }

        await browser.close();
        return finalResult;

    } catch (error: any) {
        if (browser) await browser.close();
        console.error(`❌ [ABL Direct AGIP] Error: ${error.message}`);
        return {
            status: 'ERROR',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: error.message
        };
    }
}
