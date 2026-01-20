import puppeteer from 'puppeteer';

export interface ABLProvinciaResult {
    status: 'UP_TO_DATE' | 'OVERDUE' | 'UNKNOWN' | 'ERROR';
    debtAmount: number;
    lastBillAmount: number | null;
    lastBillDate: Date | null;
    dueDate: Date | null;
    errorMessage?: string;
}

export async function checkABLProvincia(partidaId: string): Promise<ABLProvinciaResult> {
    let browser;

    try {
        console.log(`[ABL Provincia] Checking partida: ${partidaId}`);

        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to MSI portal with partida ID
        const url = `https://boletadepago.gestionmsi.gob.ar/consultar/1/${partidaId}`;
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract payment information from DevExtreme DataGrid
        const paymentInfo = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.dx-data-row'));
            const payments: Array<{
                period: string;
                dueDate: string;
                amount: string;
            }> = [];

            for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('td'));

                // DevExtreme DataGrid structure:
                // cells[3] = Cuota (period)
                // cells[4] = Vencimiento (due date)
                // cells[8] = Total (amount)

                if (cells.length > 8) {
                    const periodCell = cells[3]?.textContent?.trim() || '';
                    const dueDateCell = cells[4]?.textContent?.trim() || '';
                    const amountCell = cells[8]?.textContent?.trim() || '';

                    // Skip ANUAL payments (optional)
                    if (periodCell.toUpperCase() === 'ANUAL') {
                        continue;
                    }

                    // Extract date and amount
                    if (dueDateCell && amountCell) {
                        payments.push({
                            period: periodCell,
                            dueDate: dueDateCell,
                            amount: amountCell
                        });
                    }
                }
            }

            return payments;
        });

        console.log(`[ABL Provincia] Found ${paymentInfo.length} non-annual payments`);

        let result: ABLProvinciaResult = {
            status: 'UP_TO_DATE',
            debtAmount: 0,
            lastBillAmount: null,
            lastBillDate: null,
            dueDate: null
        };

        if (paymentInfo.length === 0) {
            console.log(`[ABL Provincia] ❓ No payment information found`);
            result.status = 'UNKNOWN';
            return result;
        }

        // Check each payment for overdue status
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day

        let totalDebt = 0;
        let hasOverdue = false;

        for (const payment of paymentInfo) {
            // Parse date (format: DD/MM/YYYY or D/M/YYYY)
            const dateParts = payment.dueDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (!dateParts) {
                console.log(`[ABL Provincia] ⚠️  Could not parse date: ${payment.dueDate}`);
                continue;
            }

            const dueDate = new Date(
                parseInt(dateParts[3]), // year
                parseInt(dateParts[2]) - 1, // month (0-indexed)
                parseInt(dateParts[1]) // day
            );

            // Parse amount (format: $ 41.300,00)
            const amountMatch = payment.amount.match(/\$\s*([\d,.]+)/);
            if (!amountMatch) {
                console.log(`[ABL Provincia] ⚠️  Could not parse amount: ${payment.amount}`);
                continue;
            }

            const amount = parseFloat(amountMatch[1].replace(/\./g, '').replace(',', '.'));

            const isOverdue = dueDate < today;
            console.log(`[ABL Provincia] Payment: ${payment.period}, Due: ${payment.dueDate}, Amount: $${amount}, Overdue: ${isOverdue}`);

            // Check if overdue
            if (isOverdue) {
                hasOverdue = true;
                totalDebt += amount;

                // Store the earliest overdue payment info
                if (!result.dueDate || dueDate < result.dueDate) {
                    result.dueDate = dueDate;
                    result.lastBillAmount = amount;
                }
            } else {
                // Store upcoming payment info if no overdue payments yet
                if (!hasOverdue && (!result.dueDate || dueDate < result.dueDate)) {
                    result.dueDate = dueDate;
                    result.lastBillAmount = amount;
                }
            }
        }

        if (hasOverdue) {
            result.status = 'OVERDUE';
            result.debtAmount = totalDebt;
            console.log(`[ABL Provincia] ⚠️  Overdue debt found: $${totalDebt}`);
        } else {
            result.status = 'UP_TO_DATE';
            result.debtAmount = 0;
            console.log(`[ABL Provincia] ✅ All payments up to date (next due: ${result.dueDate?.toLocaleDateString('es-AR')})`);
        }

        return result;

    } catch (error: any) {
        console.error('[ABL Provincia] Error:', error.message);
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
