
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

        console.log('[ABL AGIP] Page loaded, entering partida...');

        // 2. Input Partida (twice as required by form)
        const fldPartida = await page.waitForSelector('#fldPartida', { visible: true });
        if (fldPartida) {
            await fldPartida.type(partida, { delay: 100 });
        }

        const fldPartida2 = await page.waitForSelector('#fldPartida2', { visible: true });
        if (fldPartida2) {
            await fldPartida2.type(partida, { delay: 100 });
        }

        // 3. Optional DV
        if (dv) {
            const chkDv = await page.waitForSelector('#chkPartida2Dv', { visible: true });
            if (chkDv) {
                await chkDv.click();
                await new Promise(r => setTimeout(r, 500));
                const fldDv = await page.waitForSelector('#fldDv', { visible: true });
                if (fldDv) {
                    await fldDv.type(dv, { delay: 100 });
                }
            }
        }

        // 4. Handle reCAPTCHA (Humanized wait)
        console.log('[ABL AGIP] Waiting for reCAPTCHA interaction if needed...');
        await new Promise(r => setTimeout(r, 2000));

        // 5. Click Consultar
        const btnConsultar = await page.waitForSelector('#btnConsultar', { visible: true });
        if (btnConsultar) {
            await btnConsultar.click();
        } else {
            throw new Error('Consultar button not found');
        }

        // 6. Wait for results section
        console.log('[ABL AGIP] Waiting for results...');
        try {
            await page.waitForFunction(() => {
                const containerDatos = document.querySelector('#containerDatos');
                const containerError = document.querySelector('#containerError');
                return (containerDatos && !containerDatos.classList.contains('oculto')) ||
                    (containerError && !containerError.classList.contains('oculto'));
            }, { timeout: 30000 });
        } catch (e) {
            console.log('[ABL AGIP] Timeout waiting for results container');
        }

        // 7. Parse Results
        const result = await page.evaluate(() => {
            const containerError = document.querySelector('#containerError');
            if (containerError && !containerError.classList.contains('oculto')) {
                const msg = document.querySelector('#mensajeError')?.textContent?.trim();
                return { status: 'ERROR', errorMessage: msg || 'Unknown AGIP portal error' };
            }

            const containerDatos = document.querySelector('#containerDatos');
            if (containerDatos && !containerDatos.classList.contains('oculto')) {
                // Check for debt in table
                const tbody = document.querySelector('#tbody');
                const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

                let totalDebt = 0;
                rows.forEach(row => {
                    const amountCell = row.querySelector('td:nth-last-child(3)'); // Usually Importe Act. is near the end
                    if (amountCell) {
                        let text = amountCell.textContent?.replace('$', '').trim() || '';
                        // Parse Argentinian format 1.234,56
                        text = text.replace(/\./g, '').replace(',', '.');
                        const val = parseFloat(text);
                        if (!isNaN(val)) totalDebt += val;
                    }
                });

                // Also check total adeudado section if visible
                const totalAdeudadoEl = document.querySelector('#totalDeudas');
                if (totalAdeudadoEl) {
                    let text = totalAdeudadoEl.textContent?.replace('$', '').trim() || '';
                    text = text.replace(/\./g, '').replace(',', '.');
                    const val = parseFloat(text);
                    if (!isNaN(val)) totalDebt = val;
                }

                if (totalDebt > 0) {
                    return { status: 'OVERDUE', debtAmount: totalDebt };
                } else {
                    return { status: 'UP_TO_DATE', debtAmount: 0 };
                }
            }

            return { status: 'UNKNOWN', errorMessage: 'Could not identify result container' };
        });

        console.log(`[ABL AGIP] Status: ${result.status}, Debt: ${result.debtAmount || 0}`);

        if (result.status === 'UNKNOWN' || result.status === 'ERROR') {
            await page.screenshot({ path: 'abl-agip-debug.png', fullPage: true });
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
