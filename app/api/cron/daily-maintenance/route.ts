
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

// Helper to format currency
const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export async function GET(req: Request) {
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
        const url = new URL(req.url);
        const force = url.searchParams.get('force') === 'true'; // Allow manual testing
        const now = new Date();
        const day = now.getDate();
        const hour = now.getUTCHours(); // Use UTC for server consistency
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Iterate over all users with settings
        // Include appSettings to get reporting preferences
        const users = await prisma.user.findMany({
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

                    // Generate User-Specific Snapshot Data
                    const bankOps = await prisma.bankOperation.findMany({ where: { userId: user.id } });
                    const bankTotalUSD = bankOps.filter(op => op.currency === 'USD').reduce((sum, op) => sum + op.amount, 0);

                    const investments = await prisma.investment.findMany({
                        where: { userId: user.id },
                        include: { transactions: true }
                    });
                    const investmentsTotalUSD = investments.reduce((sum, inv) => {
                        const invested = inv.transactions.reduce((tSum, t) => tSum + t.totalAmount, 0);
                        return sum + Math.abs(invested);
                    }, 0);

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

                    const debts = await prisma.debt.findMany({
                        where: { userId: user.id },
                        include: { payments: true }
                    });
                    const debtTotalPendingUSD = debts.reduce((sum, d) => {
                        const paid = d.payments.reduce((pSum, p) => pSum + p.amount, 0);
                        return sum + (d.initialAmount - paid);
                    }, 0);

                    const totalNetWorthUSD = bankTotalUSD + investmentsTotalUSD + debtTotalPendingUSD;

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

                    // Send Email
                    if (process.env.RESEND_API_KEY && recipientEmail) {
                        const resend = new Resend(process.env.RESEND_API_KEY);
                        await resend.emails.send({
                            from: 'Passive Income Tracker <onboarding@resend.dev>',
                            to: recipientEmail.split(',').map((e: string) => e.trim()),
                            subject: `Resumen Mensual: ${month}/${year}`,
                            html: `
                                <h1>Resumen Mensual - ${month}/${year}</h1>
                                <p>Hola ${user.name || 'Usuario'}, aquí tienes el estado actual de tus inversiones:</p>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr style="border-bottom: 1px solid #ddd;">
                                        <td style="padding: 10px;"><strong>Patrimonio Total</strong></td>
                                        <td style="padding: 10px; text-align: right; color: #10b981; font-size: 18px;"><strong>${formatUSD(totalNetWorthUSD)}</strong></td>
                                    </tr>
                                    <tr><td>Banco / Liquidez</td><td style="text-align: right;">${formatUSD(bankTotalUSD)}</td></tr>
                                    <tr><td>Inversiones</td><td style="text-align: right;">${formatUSD(investmentsTotalUSD)}</td></tr>
                                    <tr><td>Deudas a Cobrar</td><td style="text-align: right;">${formatUSD(debtTotalPendingUSD)}</td></tr>
                                </table>
                                <br/>
                                <h3>Renta Estimada</h3>
                                <p>Alquileres Activos: <strong>${formatUSD(monthlyRentalIncomeUSD)}</strong></p>
                            `
                        });
                        userResult.success = true;
                        userResult.message = `Email sent to ${recipientEmail}`;
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

    return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        details: results
    });
}
