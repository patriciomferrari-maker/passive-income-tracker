
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { generateMonthlyReportEmail } from '@/app/lib/email-template';
import { startOfMonth, endOfMonth, isSameMonth, addMonths, isBefore, isAfter, differenceInMonths } from 'date-fns';
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

                    // 1. Bank
                    const bankOps = await prisma.bankOperation.findMany({ where: { userId: user.id } });
                    const bankTotalUSD = bankOps.filter(op => op.currency === 'USD').reduce((sum, op) => sum + op.amount, 0);

                    // 2. Investments (Split Arg/USA)
                    const investments = await prisma.investment.findMany({
                        where: { userId: user.id },
                        include: { transactions: true }
                    });

                    let investmentsTotalUSD = 0;
                    let totalArg = 0; // ONs
                    let totalUSA = 0; // Treasuries/Stocks

                    investments.forEach(inv => {
                        const invested = inv.transactions.reduce((tSum, t) => tSum + t.totalAmount, 0);
                        const currentValue = Math.abs(invested);

                        investmentsTotalUSD += currentValue;

                        if (inv.type === 'ON' || inv.type === 'CEDEAR') {
                            totalArg += currentValue;
                        } else if (inv.type === 'TREASURY' || inv.type === 'ETF' || inv.type === 'STOCK') {
                            totalUSA += currentValue;
                        } else {
                            totalArg += currentValue;
                        }
                    });

                    // 3. Rentals
                    const contracts = await prisma.contract.findMany({
                        where: { property: { userId: user.id } },
                        include: { property: true }
                    });
                    const activeContracts = contracts.filter(c => {
                        const start = new Date(c.startDate);
                        snapshotData: { bank: bankTotalUSD, investments: investmentsTotalUSD, debts: debtTotalPendingUSD, rentalsIncome: monthlyRentalIncomeUSD }
                    },
                        create: {
                        userId: user.id, month, year, totalNetWorthUSD, totalIncomeUSD: monthlyRentalIncomeUSD,
                        snapshotData: { bank: bankTotalUSD, investments: investmentsTotalUSD, debts: debtTotalPendingUSD, rentalsIncome: monthlyRentalIncomeUSD }
                    }
                    });

                // Send HTML Email
                if (process.env.RESEND_API_KEY && recipientEmail) {
                    const htmlContent = generateMonthlyReportEmail({
                        userName: user.name || 'Usuario',
                        month: monthName,
                        year: year.toString(),
                        dashboardUrl: appUrl + '/dashboard/global',

                        totalDebtPending: debtTotalPendingUSD, // Updated field
                        totalArg: totalArg,
                        totalUSA: totalUSA,

                        maturities: maturities,

                        rentalEvents: {
                            nextExpiration: nextRentalExpiration,
                            nextAdjustment: nextRentalAdjustment
                        },

                        nextPFMaturity
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
