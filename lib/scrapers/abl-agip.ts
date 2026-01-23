
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Add stealth plugin
puppeteer.use(StealthPlugin());

export interface ABLLagipResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkABLAGIP(partida: string, dv?: string): Promise<ABLLagipResult> {
    console.log(`🏛️ [ABL AGIP] Checking partida: ${partida} (DV: ${dv || 'NONE'})`);

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: false, // Visible for debugging and potential reCAPTCHA
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        }) as unknown as Browser;

        page = await browser.newPage();

        // 1. Navigate to AGIP Portal
        await page.goto('https://lb.agip.gob.ar/ConsultaABL/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('[ABL AGIP] Page loaded. Humanizing typing...');

        // 2. Input Partida (twice as required by form)
        const fldPartida = await page.waitForSelector('#fldPartida', { visible: true });
        if (fldPartida) {
            await fldPartida.click();
            for (const char of partida) {
                await page.keyboard.type(char, { delay: 100 + Math.random() * 80 });
            }
        }

        const fldPartida2 = await page.waitForSelector('#fldPartida2', { visible: true });
        if (fldPartida2) {
            await fldPartida2.click();
            for (const char of partida) {
                await page.keyboard.type(char, { delay: 100 + Math.random() * 80 });
            }
        }

        // 3. Optional DV
        if (dv) {
            const chkDv = await page.waitForSelector('#chkPartida2Dv', { visible: true });
            if (chkDv) {
                await chkDv.click();
                await new Promise(r => setTimeout(r, 600));
                const fldDv = await page.waitForSelector('#fldDv', { visible: true });
                if (fldDv) {
                    await fldDv.click();
                    await fldDv.type(dv, { delay: 150 });
                }
            }
        }

        // 4. Handle reCAPTCHA (Humanized interaction)
        console.log('[ABL AGIP] Attempting to click reCAPTCHA v2 checkbox...');

        try {
            const frames = page.frames();
            const recaptchaFrame = frames.find(f => f.url().includes('api2/anchor'));

            if (recaptchaFrame) {
                const checkbox = await recaptchaFrame.waitForSelector('#recaptcha-anchor', { visible: true, timeout: 5000 });
                if (checkbox) {
                    await checkbox.click();
                    console.log('[ABL AGIP] reCAPTCHA check clicked. Waiting for tick...');
                    // Wait for the green checkmark or challenge to appear
                    await new Promise(r => setTimeout(r, 8000));
                }
            } else {
                console.log('[ABL AGIP] reCAPTCHA iframe not found, might already be solved or score-based.');
                await new Promise(r => setTimeout(r, 4000));
            }
        } catch (e: any) {
            console.log('[ABL AGIP] reCAPTCHA interaction error:', e.message);
        }

        // 5. Click Consultar
        const btnConsultar = await page.waitForSelector('#btnConsultar', { visible: true });
        if (btnConsultar) {
            await btnConsultar.click();
        } else {
            throw new Error('Consultar button not found');
        }

        // 6. Wait for results section
        console.log('[ABL AGIP] Waiting for results table or error...');
        try {
            await page.waitForFunction(() => {
                const containerDatos = document.querySelector('#containerDatos');
                const containerError = document.querySelector('#containerError');
                const tbody = document.querySelector('#tbody');
                return (containerDatos && !containerDatos.classList.contains('oculto') && tbody && tbody.children.length > 0) ||
                    (containerError && !containerError.classList.contains('oculto'));
            }, { timeout: 25000 });
        } catch (e) {
            console.log('[ABL AGIP] Timeout waiting for explicit results. Parsing available state.');
        }

        // 7. Parse Results
        const result = await page.evaluate(() => {
            const containerError = document.querySelector('#containerError');
            if (containerError && !containerError.classList.contains('oculto')) {
                const msg = document.querySelector('#mensajeError')?.textContent?.trim();
                return { status: 'ERROR', errorMessage: msg || 'Partida inválida o error en portal' };
            }

            const containerDatos = document.querySelector('#containerDatos');
            if (containerDatos && !containerDatos.classList.contains('oculto')) {
                // Check rows in table
                const tbody = document.querySelector('#tbody');
                const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

                let totalDebt = 0;
                rows.forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    // Importe Act. (near end)
                    const amountCell = cells[cells.length - 3] || cells[cells.length - 1];
                    if (amountCell) {
                        let text = amountCell.textContent?.replace('$', '').trim() || '';
                        text = text.replace(/\./g, '').replace(',', '.');
                        const val = parseFloat(text);
                        if (!isNaN(val)) totalDebt += val;
                    }
                });

                // Total label verification
                const totalAdeudadoEl = document.querySelector('#totalDeudas');
                if (totalAdeudadoEl) {
                    let text = totalAdeudadoEl.textContent?.replace('$', '').trim() || '';
                    text = text.replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(text);
                    if (!isNaN(val) && val > 0) totalDebt = val;
                }

                if (totalDebt > 0) {
                    return { status: 'OVERDUE', debtAmount: totalDebt };
                } else if (rows.length === 0 || document.body.innerText.includes('no registra deuda')) {
                    return { status: 'UP_TO_DATE', debtAmount: 0 };
                }
            }

            return { status: 'UNKNOWN', errorMessage: 'No se pudo identificar un contenedor de resultados válido' };
        });

        console.log(`[ABL AGIP] Result: ${result.status}, Debt: ${result.debtAmount || 0}`);

        if (result.status === 'UNKNOWN' || result.status === 'ERROR') {
            await page.screenshot({ path: 'abl-agip-debug-final.png', fullPage: true });
        }

        await browser.close();
        return {
            status: (result.status as any) || 'UNKNOWN',
            debtAmount: result.debtAmount || 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null,
            errorMessage: result.errorMessage
        };

    } catch (error: any) {
        console.error('[ABL AGIP] ❌ Error:', error.message);
        if (browser) await browser.close();
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
