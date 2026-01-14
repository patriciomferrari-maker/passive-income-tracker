import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { generateMonthlyReportEmail } from '@/app/lib/email-template';
import { startOfMonth, endOfMonth, isSameMonth, addMonths, isBefore, isAfter, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateMonthlyReportPdfBuffer } from '@/app/lib/pdf-generator';
import { generateDashboardPdf } from '@/app/lib/pdf-capture';

// Economic Imports
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';
import { scrapeDolarBlue } from '@/app/lib/scrapers/dolar';
import { updateONs } from '@/app/lib/market-data';
import { regenerateAllCashflows } from '@/lib/rentals';
import { toArgNoon } from '@/app/lib/date-utils';

// Helper to format currency
const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

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
            created: stats.created, // Fixed partial assignment
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
        const ipcData = await scrapeInflationData();
        let ipcCount = 0;
        for (const item of ipcData) {
            await prisma.inflationData.upsert({
                where: { year_month: { year: item.year, month: item.month } },
                update: { value: item.value },
                create: { year: item.year, month: item.month, value: item.value }
            });
            ipcCount++;
        }

        // SYNC WITH EconomicIndicator
        for (const item of ipcData) {
            const date = new Date(item.year, item.month - 1, 1);
            date.setUTCHours(12, 0, 0, 0);

            await prisma.economicIndicator.upsert({
                where: { type_date: { type: 'IPC', date } },
                update: { value: item.value },
                create: { type: 'IPC', date, value: item.value }
            });
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

export async function runDailyMaintenance(force: boolean = false, targetUserId?: string | null) {
    // Removed inline helper in favor of shared util (toArgNoon)

    const results = {
        economics: await runEconomicUpdates(),
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

                    // 1. Bank
                    const bankTotalUSD = stats.bank.totalUSD;

                    // 2. Investments
                    const totalArg = stats.on.totalInvested; // Uses Market Value + FIFO
                    const totalUSA = stats.treasury.totalInvested;

                    const hasArg = stats.on.count > 0;
                    const hasUSA = stats.treasury.count > 0;

                    // 3. Rentals
                    const monthlyRentalIncomeUSD = stats.rentals.totalIncome;
                    const hasRentals = stats.rentals.count > 0;

                    // 4. Debts
                    const debtTotalPendingUSD = stats.debts.totalPending;
                    const hasDebts = stats.debts.count > 0;

                    const totalNetWorthUSD = bankTotalUSD + totalArg + totalUSA + debtTotalPendingUSD;

                    // --- KEY DATES (Calculations) ---
                    // Re-fetch only strictly necessary event lists that aren't in summary stats
                    // (Rentals Events need detailed list, stats only has summary)
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

                    // Next PF Maturity - Take from stats
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

                    // 2. Current Month PF Maturities
                    // 2. Current Month PF Maturities (From Stats)
                    stats.bank.nextMaturitiesPF.forEach((pf: any) => {
                        // Check if it's in the current month to be consistent with 'maturities' list
                        // FIX: Standardize to ARG Noon using helper
                        const adjustedDate = toArgNoon(pf.rawDate);

                        if (isSameMonth(adjustedDate, now)) {
                            // Format currency helper
                            const formatUSD = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(val);

                            maturities.push({
                                date: adjustedDate,
                                description: `PF ${pf.alias}`,
                                amount: pf.interest || 0, // Show ONLY Interest
                                currency: 'USD',
                                type: 'PF',
                                meta: `Total al vencimiento: ${formatUSD(pf.amount)}` // Show Total
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

                    // Send HTML Email
                    if (process.env.RESEND_API_KEY && recipientEmail) {
                        const htmlContent = generateMonthlyReportEmail({
                            userName: user.name || 'Usuario',
                            month: monthName,
                            year: year.toString(),
                            dashboardUrl: appUrl + '/dashboard/global',
                            totalDebtPending: debtTotalPendingUSD,
                            totalBank: bankTotalUSD, // Added
                            totalArg: totalArg,
                            totalUSA: totalUSA,
                            maturities: maturities,
                            rentalEvents: rentalEventsList, // Updated
                            hasRentals,
                            hasArg,
                            hasUSA,
                            hasBank: bankTotalUSD > 1,
                            hasDebts: Math.abs(debtTotalPendingUSD) > 1
                        });

                        // Prepare PDF Attachments
                        const attachments: any[] = [];

                        // 1. Consolidated Dashboard PDF (Headless Chrome)
                        if (process.env.CRON_SECRET) {
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
                        } else {
                            console.warn('Skipping PDF generation: CRON_SECRET not defined');
                        }

                        // 2. Specific Section Reports (Investments, Rentals, Finance)
                        if (process.env.CRON_SECRET) {
                            // Investments
                            if (hasArg || hasUSA) {
                                try {
                                    const pdf = await generateDashboardPdf(user.id, 'investments', appUrl, process.env.CRON_SECRET);
                                    attachments.push({ filename: `Detalle_Inversiones_${monthName}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating Investments PDF:', e); }
                            }

                            // Rentals
                            if (hasRentals) {
                                try {
                                    const pdf = await generateDashboardPdf(user.id, 'rentals', appUrl, process.env.CRON_SECRET);
                                    attachments.push({ filename: `Detalle_Alquileres_${monthName}.pdf`, content: pdf });
                                } catch (e) { console.error('Error generating Rentals PDF:', e); }
                            }

                            // Finance (Barbosa)
                            try {
                                const pdf = await generateDashboardPdf(user.id, 'finance', appUrl, process.env.CRON_SECRET);
                                attachments.push({ filename: `Detalle_Hogar_${monthName}.pdf`, content: pdf });
                            } catch (e) { console.error('Error generating Finance PDF:', e); }
                        }

                        // Send Email with Attachments
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
