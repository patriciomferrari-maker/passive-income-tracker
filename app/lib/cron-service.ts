import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { generateMonthlyReportEmail, PassiveIncomeStats } from '@/app/lib/email-template';
import { startOfMonth, endOfMonth, isSameMonth, addMonths, isBefore, isAfter, differenceInMonths, subMonths, subHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateMonthlyReportPdfBuffer } from '@/app/lib/pdf-generator';
import { generateDashboardPdf } from '@/app/lib/pdf-capture';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';
import { scrapeDolarBlue } from '@/app/lib/scrapers/dolar';
import { updateONs } from '@/app/lib/market-data';
import { regenerateAllCashflows } from '@/lib/rentals';
import { toArgNoon } from '@/app/lib/date-utils';

// Helper for Passive Income (Previous Month)
async function getPreviousMonthPassiveIncome(userId: string, targetDate: Date): Promise<PassiveIncomeStats> {
    const prevMonthDate = subMonths(targetDate, 1);
    const start = startOfMonth(prevMonthDate);
    const end = endOfMonth(prevMonthDate);
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(prevMonthDate);

    // 1. Interests (Cashflows) - ARG & USA
    const interestCashflows = await prisma.cashflow.findMany({
        where: {
            investment: { userId },
            date: { gte: start, lte: end },
            type: { in: ['INTEREST', 'COUPON', 'DIVIDEND'] },
        },
        include: { investment: { select: { market: true } } }
    });

    let interestArg = 0;
    let interestUsa = 0;

    interestCashflows.forEach(cf => {
        let val = cf.amount;
        if (cf.currency !== 'USD') val = 0; // Skip ARS for now

        if (cf.investment.market === 'ARG') interestArg += val;
        else interestUsa += val;
    });

    // 2. Plazo Fijo Interests (BankOperations)
    const allPFs = await prisma.bankOperation.findMany({
        where: { userId, type: 'PLAZO_FIJO', startDate: { not: null } }
    });

    let pfInterest = 0;
    allPFs.forEach(pf => {
        if (!pf.startDate || !pf.durationDays) return;
        const maturityDate = new Date(pf.startDate);
        maturityDate.setDate(maturityDate.getDate() + pf.durationDays);

        if (maturityDate >= start && maturityDate <= end) {
            const interest = (pf.amount * (pf.tna || 0) / 100) * (pf.durationDays / 365);
            let valUSD = interest;
            if (pf.currency === 'ARS') valUSD = interest / 1140; // Approx rate conversion
            pfInterest += valUSD;
        }
    });

    // 3. Rentals (RentalCashflow)
    const rentals = await prisma.rentalCashflow.findMany({
        where: { contract: { property: { userId } }, date: { gte: start, lte: end } },
        select: { amountUSD: true }
    });
    const rentalIncome = rentals.reduce((acc, curr) => acc + (curr.amountUSD || 0), 0);

    // 4. Costa Esmeralda (CostaTransaction)
    const costaTxs = await prisma.costaTransaction.findMany({
        where: {
            userId,
            type: 'INCOME',
            date: { gte: start, lte: end },
            category: { name: 'Alquiler' }
        },
        include: { category: true }
    });

    const costaIncome = costaTxs.reduce((acc, curr) => acc + curr.amount, 0);

    // 5. Debt (DebtPayment) - Only count payments on debts OWED TO the user (income)
    const debtPayments = await prisma.debtPayment.findMany({
        where: {
            debt: {
                userId,
                type: 'OWED_TO_ME'  // Only count money collected, not money paid
            },
            date: { gte: start, lte: end },
            type: 'PAYMENT'
        }
    });
    const debtCollected = debtPayments.reduce((acc, curr) => acc + curr.amount, 0);

    return {
        monthName,
        total: interestArg + interestUsa + pfInterest + rentalIncome + costaIncome + debtCollected,
        interests: { arg: interestArg, usa: interestUsa },
        rentals: { regular: rentalIncome, costa: costaIncome },
        plazoFijo: pfInterest,
        debtCollected
    };
}

export async function runEconomicUpdates() {
    const results = {
        ipc: { status: 'skipped', count: 0, error: null as any },
        dolar: { status: 'skipped', count: 0, error: null as any },
        ons: { status: 'skipped', count: 0, error: null as any },
        bcra: { status: 'skipped', count: 0, error: null as any, seeded: false, created: 0, updated: 0, skipped: 0 }
    };

    // 1. Update BCRA Data FIRST
    try {
        console.log('🌐 Scraping latest BCRA data...');
        const { scrapeBCRA, saveBCRAData } = await import('@/app/lib/scrapers/bcra');
        const data = await scrapeBCRA();
        const stats = await saveBCRAData(data);

        results.bcra = {
            status: 'success',
            count: stats.created + stats.updated,
            error: null,
            created: stats.created,
            updated: stats.updated,
            skipped: stats.skipped,
            seeded: false
        };
        console.log(`✅ BCRA update: ${stats.created} created, ${stats.updated} updated`);
    } catch (e) {
        results.bcra = {
            status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e),
            seeded: false, created: 0, updated: 0, skipped: 0
        };
        console.error('Cron BCRA Error:', e);
    }

    // 2. Update IPC
    try {
        const { upsertIPC } = await import('@/lib/economic-data');
        const ipcData = await scrapeInflationData();
        let ipcCount = 0;

        for (const item of ipcData) {
            const date = new Date(item.year, item.month - 1, 1);

            // Check if manual exists before overwriting? 
            // The constraint @@unique([type, date]) handles uniqueness.
            // But we need to respect "isManual" flag.
            // Let's rely on upsertIPC or check explicitly.
            // For now, to keep it simple and safe, we can check if it's manual.
            const existing = await prisma.economicIndicator.findUnique({
                where: { type_date: { type: 'IPC', date: new Date(Date.UTC(item.year, item.month - 1, 1)) } }
            });

            if (existing && existing.isManual) {
                console.log(`Skipping manual IPC for ${item.year}-${item.month}`);
                continue;
            }

            // Using upsertIPC handles normalization.
            await upsertIPC(date, item.value);
            ipcCount++;
        }

        if (ipcCount > 0) {
            await regenerateAllCashflows();
        }
        results.ipc = { status: 'success', count: ipcCount, error: null };
    } catch (e) {
        results.ipc = { status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e) };
    }

    // 3. Update Dollar
    try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dollarData = await scrapeDolarBlue(startDate, endDate);
        let dollarCount = 0;

        for (const item of dollarData) {
            const dayStart = new Date(item.date);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(item.date);
            dayEnd.setUTCHours(23, 59, 59, 999);

            const existing = await prisma.economicIndicator.findFirst({
                where: { type: 'TC_USD_ARS', date: { gte: dayStart, lte: dayEnd } }
            });

            if (existing) {
                await prisma.economicIndicator.update({
                    where: { id: existing.id },
                    data: { value: item.avg, buyRate: item.buy, sellRate: item.sell }
                });
            } else {
                await prisma.economicIndicator.create({
                    data: { type: 'TC_USD_ARS', date: item.date, value: item.avg, buyRate: item.buy, sellRate: item.sell }
                });
            }
            dollarCount++;
        }
        results.dolar = { status: 'success', count: dollarCount, error: null };
    } catch (e) {
        results.dolar = { status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e) };
    }

    // 4. Update ONs
    try {
        const onsResults = await updateONs();
        results.ons = { status: 'success', count: onsResults.length, error: null };
    } catch (e) {
        results.ons = { status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e) };
    }

    return results;
}

export async function runDailyMaintenance(force: boolean = false, targetUserId?: string | null, skipScraping: boolean = false) {
    const results = {
        economics: skipScraping ? { status: 'skipped' } : await runEconomicUpdates(),
        reports: [] as any[]
    };

    // --- PART 2: MONTHLY REPORTS (Per User) ---
    try {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        const day = now.getDate();
        const hour = now.getUTCHours();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(now);
        const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

        const users = await prisma.user.findMany({
            where: targetUserId ? { id: targetUserId } : undefined,
            include: { appSettings: true }
        });

        for (const user of users) {
            const userResult = { userId: user.id, email: user.email, success: false, message: '', skipped: true };

            try {
                const settings = user.appSettings[0];
                const reportDay = settings?.reportDay ?? 1;
                const reportHour = settings?.reportHour ?? 10;
                const recipientEmail = settings?.notificationEmails || user.email;

                if (force || (day === reportDay)) {
                    userResult.skipped = false;

                    // NEW: Use Shared Dashboard Data Logic for Consistency
                    const { getDashboardStats } = await import('@/app/lib/dashboard-data');
                    const stats = await getDashboardStats(user.id);

                    // 1. Bank (Now refers to Liquidity Only)
                    const bankTotalUSD = stats.bank.totalUSD; // This is now 'liquidityUSD' from shared logic

                    // 2. Investments
                    // Inversiones tiene que ser: Cartera Argentina + Cartera USA + Plazo Fijo + FCI
                    // We treat PFs and FCIs as "Arg Investments" for the sake of the report summary summing.
                    const investedPF = (stats.bank as any).investedPF_USD || 0;
                    const investedFCI = (stats.bank as any).investedFCI_USD || 0;

                    const hasBank = bankTotalUSD > 1 || investedPF > 1;

                    const totalArg = stats.on.totalInvested + investedPF + investedFCI;
                    const totalUSA = stats.treasury.totalInvested;

                    const hasArg = stats.on.count > 0 || investedPF > 0 || investedFCI > 0;
                    const hasUSA = stats.treasury.count > 0;

                    // 3. Rentals
                    const monthlyRentalIncomeUSD = stats.rentals.totalIncome;
                    const hasRentals = stats.rentals.count > 0;

                    // 4. Debts
                    const debtTotalPendingUSD = stats.debts.totalPending;
                    const hasDebts = Math.abs(debtTotalPendingUSD) > 1;

                    const totalNetWorthUSD = bankTotalUSD + totalArg + totalUSA + debtTotalPendingUSD;

                    // --- KEY DATES (Calculations) ---
                    const contracts = await prisma.contract.findMany({
                        where: { property: { userId: user.id } },
                        include: { property: true }
                    });
                    const rentalEventsList: { date: Date; property: string; type: 'ADJUSTMENT' | 'EXPIRATION'; monthsTo: number }[] = [];
                    const eventHorizon = addMonths(now, 12);
                    contracts.forEach(c => {
                        // Standardize Start Date
                        const startDate = toArgNoon(c.startDate);

                        const expDate = addMonths(startDate, c.durationMonths);
                        if (isAfter(expDate, now)) {
                            rentalEventsList.push({ date: expDate, property: c.property.name, type: 'EXPIRATION', monthsTo: differenceInMonths(expDate, now) });
                        }
                        if (c.adjustmentType !== 'NONE') {
                            let nextAdjDate = new Date(startDate);
                            while (isBefore(nextAdjDate, now) || nextAdjDate.getTime() === now.getTime()) nextAdjDate = addMonths(nextAdjDate, c.adjustmentFrequency);
                            while (isBefore(nextAdjDate, eventHorizon)) {
                                rentalEventsList.push({ date: new Date(nextAdjDate), property: c.property.name, type: 'ADJUSTMENT', monthsTo: differenceInMonths(nextAdjDate, now) });
                                nextAdjDate = addMonths(nextAdjDate, c.adjustmentFrequency);
                            }
                        }
                    });
                    rentalEventsList.sort((a, b) => a.date.getTime() - b.date.getTime());

                    const nextPFMaturity = stats.bank.nextMaturitiesPF.length > 0
                        ? { ...stats.bank.nextMaturitiesPF[0], bank: stats.bank.nextMaturitiesPF[0].alias }
                        : null;

                    // --- DETAILED MATURITIES (Full Month) ---
                    const maturities: any[] = [];

                    // 1. Current Month Cashflows (All, not just future)
                    const monthCashflows = await prisma.cashflow.findMany({
                        where: {
                            investment: { userId: user.id },
                            date: { gte: monthStart, lte: monthEnd },
                            status: 'PROJECTED'
                        },
                        include: { investment: true }
                    });

                    monthCashflows.forEach(cf => {
                        maturities.push({
                            date: toArgNoon(cf.date), // Standardize
                            description: `${cf.investment.name} (${cf.type === 'INTEREST' ? 'Interés' : 'Amort.'})`,
                            amount: cf.amount,
                            currency: cf.currency,
                            type: cf.investment.type === 'ON' ? 'ON' : 'TREASURY'
                        });
                    });

                    // 2. Plazo Fijo Maturities (Current Month)
                    const currentMonthPFs = await prisma.bankOperation.findMany({
                        where: { userId: user.id, type: 'PLAZO_FIJO', startDate: { not: null } }
                    });

                    currentMonthPFs.forEach(pf => {
                        if (!pf.startDate || !pf.durationDays) return;
                        const maturityDate = new Date(pf.startDate);
                        maturityDate.setDate(maturityDate.getDate() + pf.durationDays);

                        // Shift to Argentina Time (UTC-3) for correct month assignment
                        const maturityDateArg = subHours(maturityDate, 3);

                        // Check if maturity is in the report month
                        if (isSameMonth(maturityDateArg, monthStart)) {
                            const interest = (pf.amount * (pf.tna || 0) / 100) * (pf.durationDays / 365);
                            const total = pf.amount + interest;
                            const formatUSD = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(val);

                            // Adjust date for display (Arg Noon)
                            const displayDate = new Date(maturityDateArg);
                            displayDate.setHours(12, 0, 0, 0);

                            maturities.push({
                                date: displayDate,
                                description: `Plazo Fijo ${pf.alias || ''}`,
                                amount: interest, // Show Interest Only as per request? Or Total? 
                                // User screenshot showed "Interés" for bonds. 
                                // Usually for PF we show Interest in the list, and maybe Total in meta.
                                currency: pf.currency || 'ARS', // use PF currency
                                type: 'PF',
                                meta: `Total: ${formatUSD(total)}`
                            });
                        }
                    });

                    // Save Snapshot
                    await prisma.monthlySummary.upsert({
                        where: { userId_month_year: { userId: user.id, month, year } },
                        update: {
                            totalNetWorthUSD, totalIncomeUSD: monthlyRentalIncomeUSD,
                            snapshotData: { bank: bankTotalUSD, investments: totalArg + totalUSA, debts: debtTotalPendingUSD, rentalsIncome: monthlyRentalIncomeUSD }
                        },
                        create: {
                            userId: user.id, month, year, totalNetWorthUSD, totalIncomeUSD: monthlyRentalIncomeUSD,
                            snapshotData: { bank: bankTotalUSD, investments: totalArg + totalUSA, debts: debtTotalPendingUSD, rentalsIncome: monthlyRentalIncomeUSD }
                        }
                    });

                    // NEW: Calculate Previous Month Passive Income
                    const passiveIncomeStats = await getPreviousMonthPassiveIncome(user.id, now);

                    // Send HTML Email


                    if (process.env.RESEND_API_KEY && recipientEmail) {
                        const htmlContent = generateMonthlyReportEmail({
                            userName: user.name || 'Usuario',
                            month: monthName,
                            year: year.toString(),
                            dashboardUrl: appUrl + '/dashboard/global',
                            totalDebtPending: debtTotalPendingUSD,
                            totalBank: bankTotalUSD,
                            totalArg: totalArg,
                            totalUSA: totalUSA,
                            maturities: maturities,
                            rentalEvents: rentalEventsList,
                            previousMonthPassiveIncome: passiveIncomeStats, // Include New Stat
                            hasRentals,
                            hasArg,
                            hasUSA,
                            hasBank,
                            hasDebts
                        });

                        // Prepare PDF Attachments
                        const attachments: any[] = [];

                        if (process.env.CRON_SECRET) {
                            /*
                            try {
                                console.log(`Generating Dashboard PDF for user ${user.id}...`);
                                const dashboardPdf = await generateDashboardPdf(user.id, 'dashboard', appUrl, process.env.CRON_SECRET);
                                attachments.push({
                                    filename: `Resumen_Financiero_${monthName}_${year}.pdf`,
                                    content: dashboardPdf
                                });
                            } catch (e) {
                                console.error('Error generating Dashboard PDF:', e);
                            }
                            */
                        } else {
                            console.warn('Skipping PDF generation: CRON_SECRET not defined');
                        }

                        if (process.env.CRON_SECRET) {

                            // 1. Inversiones Argentina
                            // Condition: Active CEDEAR/ETF (qty > 0) OR Active ON (Maturity > Now)
                            const argInvestments = await prisma.investment.findMany({
                                where: { userId: user.id, market: 'ARG' }
                            });

                            const hasActiveArg = argInvestments.some(inv => {
                                const isEquity = ['CEDEAR', 'ETF', 'ACCION'].includes(inv.type || '');
                                const isON = ['ON', 'CORPORATE_BOND'].includes(inv.type || '');

                                if (isEquity) return inv.quantity > 0;
                                if (isON) {
                                    // Check maturity if available, otherwise fallback to quantity
                                    if (inv.maturityDate) {
                                        return new Date(inv.maturityDate) > now;
                                    }
                                    return inv.quantity > 0;
                                }
                                return inv.quantity > 0; // Default for others (FCI, etc)
                            });

                            if (hasActiveArg) {
                                try {
                                    console.log(`Generating ARG Investments PDF for user ${user.id}...`);
                                    const pdf = await generateDashboardPdf(user.id, 'investments', appUrl, process.env.CRON_SECRET, { market: 'ARG' });
                                    attachments.push({ filename: `Inversiones_Argentina_${monthName}_${year}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating Arg Investments PDF:', e); }
                            }

                            /*
                            // 2. Inversiones USA
                            if (hasUSA) {
                                try {
                                    const pdf = await generateDashboardPdf(user.id, 'investments', appUrl, process.env.CRON_SECRET, { market: 'USA' });
                                    attachments.push({ filename: `Inversiones_USA_${monthName}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating USA Investments PDF:', e); }
                            }

                            // 3. Bank (Liquidez + Plazo Fijo)
                            if (hasBank) {
                                try {
                                    const pdf = await generateDashboardPdf(user.id, 'bank', appUrl, process.env.CRON_SECRET);
                                    attachments.push({ filename: `Resumen_Bancario_${monthName}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating Bank PDF:', e); }
                            }

                            // 4. Debts
                            if (hasDebts) {
                                try {
                                    const pdf = await generateDashboardPdf(user.id, 'debts', appUrl, process.env.CRON_SECRET);
                                    attachments.push({ filename: `Estado_Deudas_${monthName}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating Debts PDF:', e); }
                            }
                            */

                            // 5. Rentals
                            // Strict check: Only attach PDF if there are ACTIVE contracts
                            const activeContractsCount = contracts.filter(c => {
                                const start = new Date(c.startDate);
                                const end = addMonths(start, c.durationMonths);
                                return start <= now && end >= now;
                            }).length;

                            if (activeContractsCount > 0) {
                                try {
                                    console.log(`Generating Rentals PDF for user ${user.id} (Active Contracts: ${activeContractsCount})...`);
                                    const pdf = await generateDashboardPdf(user.id, 'rentals', appUrl, process.env.CRON_SECRET);
                                    // Use clearer filename as per request? "Resumen_Alquileres" sounds good.
                                    attachments.push({ filename: `Resumen_Alquileres_${monthName}_${year}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating Rentals PDF:', e); }
                            }

                            /*
                            // 6. Finance / Hogar
                            try {
                                const pdf = await generateDashboardPdf(user.id, 'finance', appUrl, process.env.CRON_SECRET);
                                attachments.push({ filename: `Detalle_Hogar_${monthName}.pdf`, content: pdf });
                            } catch (e) { console.error('Error generating Finance PDF:', e); }
                            */
                        }

                        console.log(`Sending email to: ${recipientEmail} with key: ${process.env.RESEND_API_KEY?.substring(0, 4)}...`);

                        const resend = new Resend(process.env.RESEND_API_KEY);
                        const emailResponse = await resend.emails.send({
                            from: 'Passive Income Tracker <onboarding@resend.dev>',
                            to: recipientEmail.split(',').map((e: string) => e.trim()),
                            subject: `Resumen Mensual: ${monthName} ${year}`,
                            html: htmlContent,
                            attachments: attachments
                        });
                        console.log('Resend Response:', emailResponse);

                        if (emailResponse.error) {
                            throw new Error('Resend Error: ' + emailResponse.error.message);
                        }

                        userResult.success = true;
                        userResult.message = `Enhanced Email with ${attachments.length} PDFs sent to ${recipientEmail}. ID: ${emailResponse.data?.id}`;
                    } else {
                        console.log('Missing Key or Email:', { key: !!process.env.RESEND_API_KEY, recipientEmail });
                        userResult.success = false;
                        userResult.message = 'Missing RESEND_API_KEY or Recipient Email';
                    }
                } else {
                    userResult.message = `Skipped: Not time (Day ${reportDay}, Hour ${reportHour})`;
                }

            } catch (uError: any) {
                console.error(`Error processing user ${user.id}:`, uError);
                userResult.success = false;
                userResult.message = uError.message;
            }
            results.reports.push(userResult);
        }
    } catch (error: any) {
        console.error('Reports Loop Error:', error);
    }

    return {
        success: true,
        timestamp: new Date().toISOString(),
        details: results
    };
}
