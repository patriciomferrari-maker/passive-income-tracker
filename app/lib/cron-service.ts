

import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { generateMonthlyReportEmail } from '@/app/lib/email-template';
import { startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper to format currency
const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export async function runDailyMaintenance(force: boolean = false, targetUserId?: string | null) {
    const results = {
        economics: {
            blue: { success: false, message: '' },
            ipc: { success: false, message: '' }
        },
        reports: [] as any[]
    };

    // --- PART 1: ECONOMICS (Global - Run once) ---
    // Only run economics if NOT targeting a specific user (global run) OR if forced? 
    // Actually, usually we want economics to run globally. 
    // But if testing email for one user, we probably don't care about economics update, but it doesn't hurt.
    // Let's keep it simple: run it always unless we want to optimize later.
    try {
        // 1. Dolar Blue
        try {
            const response = await fetch('https://dolarapi.com/v1/dolares/blue');
            if (response.ok) {
                const data = await response.json();
                const rate = data.venta;
                const today = new Date();
                const monthDate = new Date(today.getFullYear(), today.getMonth(), 1);

                const existing = await prisma.economicIndicator.findFirst({
                    where: { type: 'TC_USD_ARS', date: monthDate }
                });

                if (existing) {
                    await prisma.economicIndicator.update({
                        where: { id: existing.id }, data: { value: rate }
                    });
                    results.economics.blue = { success: true, message: `Updated: ${rate}` };
                } else {
                    await prisma.economicIndicator.create({
                        data: { type: 'TC_USD_ARS', date: monthDate, value: rate }
                    });
                    results.economics.blue = { success: true, message: `Created: ${rate}` };
                }
            }
        } catch (e: any) {
            results.economics.blue = { success: false, message: e.message };
        }

        // 2. IPC Check
        try {
            const today = new Date();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const hasIPC = await prisma.economicIndicator.findFirst({
                where: { type: 'IPC', date: lastMonth }
            });
            results.economics.ipc = hasIPC
                ? { success: true, message: 'Found last month IPC' }
                : { success: false, message: 'Missing last month IPC' };
        } catch (e: any) {
            results.economics.ipc = { success: false, message: e.message };
        }

    } catch (error: any) {
        console.error('Economics Update Error:', error);
    }

    // --- PART 2: MONTHLY REPORTS (Per User) ---
    try {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        const day = now.getDate();
        const hour = now.getUTCHours(); // Use UTC for server consistency
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(now);

        // Iterate over all users with settings (or specific user)
        // Include appSettings to get reporting preferences
        const users = await prisma.user.findMany({
            where: targetUserId ? { id: targetUserId } : undefined,
            include: { appSettings: true }
        });

        for (const user of users) {
            const userResult = { userId: user.id, email: user.email, success: false, message: '', skipped: true };

            try {
                // Use first settings or defaults
                const settings = user.appSettings[0];
                const reportDay = settings?.reportDay ?? 1;
                const reportHour = settings?.reportHour ?? 10;
                const recipientEmail = settings?.notificationEmails || user.email;

                // Check schedule
                if (force || (day === reportDay)) {
                    userResult.skipped = false;

                    // 1. Bank Data (Liquidity & PFs)
                    const bankOps = await prisma.bankOperation.findMany({ where: { userId: user.id } });
                    const bankTotalUSD = bankOps.filter(op => op.currency === 'USD').reduce((sum, op) => sum + op.amount, 0);

                    // 2. Investment Totals
                    const investments = await prisma.investment.findMany({
                        where: { userId: user.id },
                        include: { transactions: true }
                    });
                    const investmentsTotalUSD = investments.reduce((sum, inv) => {
                        const invested = inv.transactions.reduce((tSum, t) => tSum + t.totalAmount, 0);
                        return sum + Math.abs(invested);
                    }, 0);

                    // 3. Rental Income (Active Contracts)
                    const contracts = await prisma.contract.findMany({
                        where: { property: { userId: user.id } }
                    });
                    const activeContracts = contracts.filter(c => {
                        const start = new Date(c.startDate);
                        const end = new Date(start);
                        end.setMonth(end.getMonth() + c.durationMonths);
                        return now >= start && now <= end;
                    });
                    const monthlyRentalIncomeUSD = activeContracts.reduce((sum, c) => sum + (c.currency === 'USD' ? c.initialRent : 0), 0);

                    // 4. Debt Totals
                    const debts = await prisma.debt.findMany({
                        where: { userId: user.id },
                        include: { payments: true }
                    });
                    const debtTotalPendingUSD = debts.reduce((sum, d) => {
                        const paid = d.payments.reduce((pSum, p) => pSum + p.amount, 0);
                        return sum + (d.initialAmount - paid);
                    }, 0);

                    const totalNetWorthUSD = bankTotalUSD + investmentsTotalUSD + debtTotalPendingUSD;

                    // --- DETAILED MATURITIES FETCHING (NEW) ---
                    const maturities = [];

                    // A. Investment Cashflows (This Month)
                    const monthCashflows = await prisma.cashflow.findMany({
                        where: {
                            investment: { userId: user.id },
                            date: { gte: monthStart, lte: monthEnd },
                            status: 'PROJECTED' // Only show what is coming or due, typically. Or allow PAID if reviewing.
                        },
                        include: { investment: true }
                    });

                    monthCashflows.forEach(cf => {
                        maturities.push({
                            date: cf.date,
                            description: `${cf.investment.name} (${cf.type})`,
                            amount: cf.amount,
                            currency: cf.currency,
                            type: cf.investment.type === 'ON' ? 'ON' : 'TREASURY'
                        });
                    });

                    // B. Fixed Term (Plazo Fijo) Maturities (This Month)
                    const pfs = bankOps.filter(op => op.type === 'PLAZO_FIJO' && op.startDate);
                    pfs.forEach(pf => {
                        const start = new Date(pf.startDate!);
                        const end = new Date(start);
                        end.setDate(start.getDate() + (pf.durationDays || 30));

                        if (isSameMonth(end, now)) {
                            // Calc Interest approx
                            const interest = (pf.amount * (pf.tna || 0) / 100) * ((pf.durationDays || 30) / 365);
                            maturities.push({
                                date: end,
                                description: `${pf.alias || 'Plazo Fijo'} (Vencimiento)`,
                                amount: pf.amount + interest,
                                currency: pf.currency,
                                type: 'PF'
                            });
                        }
                    });

                    // C. Rental Collections (Assume Day 1 to 10 typically, or just list active contracts)
                    // For now, let's list active rentals as "Collection" for today or Day 10.
                    activeContracts.forEach(c => {
                        // Assume collection date is roughly today or standardized.
                        // Let's use the report date (today) for simplicity or the 5th.
                        const collectionDate = new Date(now.getFullYear(), now.getMonth(), 5);
                        // Only show if collection date is future or recent?
                        maturities.push({
                            date: collectionDate, // Or today
                            description: `Alquiler: ${c.tenantName || 'Inquilino'}`,
                            amount: c.initialRent,
                            currency: c.currency,
                            type: 'RENTAL'
                        });
                    });

                    // --- END DETAILS ---

                    // Save Snapshot (User Specific)
                    await prisma.monthlySummary.upsert({
                        where: {
                            userId_month_year: { userId: user.id, month, year }
                        },
                        update: {
                            totalNetWorthUSD, totalIncomeUSD: monthlyRentalIncomeUSD,
                            snapshotData: { bank: bankTotalUSD, investments: investmentsTotalUSD, debts: debtTotalPendingUSD, rentalsIncome: monthlyRentalIncomeUSD }
                        },
                        create: {
                            userId: user.id,
                            month, year, totalNetWorthUSD, totalIncomeUSD: monthlyRentalIncomeUSD,
                            snapshotData: { bank: bankTotalUSD, investments: investmentsTotalUSD, debts: debtTotalPendingUSD, rentalsIncome: monthlyRentalIncomeUSD }
                        }
                    });

                    // Send HTML Email
                    if (process.env.RESEND_API_KEY && recipientEmail) {
                        const htmlContent = generateMonthlyReportEmail({
                            userName: user.name || 'Usuario',
                            month: monthName,
                            year: year.toString(),
                            totalNetWorth: totalNetWorthUSD,
                            monthlyIncome: monthlyRentalIncomeUSD,
                            maturities: maturities as any
                        });

                        const resend = new Resend(process.env.RESEND_API_KEY);
                        await resend.emails.send({
                            from: 'Passive Income Tracker <onboarding@resend.dev>',
                            to: recipientEmail.split(',').map((e: string) => e.trim()),
                            subject: `Resumen Mensual: ${monthName} ${year}`,
                            html: htmlContent
                        });
                        userResult.success = true;
                        userResult.message = `Enhanced Email sent to ${recipientEmail}`;
                    } else {
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
