
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

// Helper to format currency
const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export async function GET(req: Request) {
    // 1. Authorization Check (CRON_SECRET)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const url = new URL(req.url);
        const force = url.searchParams.get('force') === 'true';

        const now = new Date();
        const month = now.getMonth() + 1; // 1-12
        const year = now.getFullYear();
        const day = now.getDate();

        // 2. Load Settings & Check Schedule
        const settings = await prisma.appSettings.findFirst();

        // Default to day 1 if no settings, or use configured day
        const reportDay = settings?.reportDay || 1;
        // Default to hardcoded email if settings empty, or env var
        const recipientEmail = settings?.notificationEmails || process.env.RECIPIENT_EMAIL || 'patriciomferrari@gmail.com';

        // If not force, and not the right day, skip.
        if (!force) {
            if (day !== reportDay) {
                return NextResponse.json({ skipped: true, reason: `Today is day ${day}, waiting for day ${reportDay}` });
            }
        }

        // 3. Aggregate Data (Snapshot)

        // A. Bank Investments
        const bankOps = await prisma.bankOperation.findMany();
        const bankTotalUSD = bankOps
            .filter(op => op.currency === 'USD')
            .reduce((sum, op) => sum + op.amount, 0);

        // B. Investments (ON + Treasury)
        const investments = await prisma.investment.findMany({ include: { transactions: true } });
        const investmentsTotalUSD = investments.reduce((sum, inv) => {
            const invested = inv.transactions.reduce((tSum, t) => tSum + t.totalAmount, 0);
            return sum + Math.abs(invested);
        }, 0);

        // C. Active Rentals
        const contracts = await prisma.contract.findMany({ include: { rentalCashflows: true } });
        const activeContracts = contracts.filter(c => {
            const start = new Date(c.startDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + c.durationMonths);
            return now >= start && now <= end;
        });

        const monthlyRentalIncomeUSD = activeContracts.reduce((sum, c) => {
            return sum + (c.currency === 'USD' ? c.initialRent : 0);
        }, 0);

        // D. Debts
        const debts = await prisma.debt.findMany({ include: { payments: true } });
        const debtTotalPendingUSD = debts.reduce((sum, d) => {
            const paid = d.payments.reduce((pSum, p) => pSum + p.amount, 0);
            return sum + (d.initialAmount - paid);
        }, 0);


        // Total Net Worth
        const totalNetWorthUSD = bankTotalUSD + investmentsTotalUSD + debtTotalPendingUSD;

        // 4. Save Snapshot (Always update/upsert)
        const snapshot = await prisma.monthlySummary.upsert({
            where: {
                month_year: {
                    month,
                    year
                }
            },
            update: {
                totalNetWorthUSD,
                totalIncomeUSD: monthlyRentalIncomeUSD,
                snapshotData: {
                    bank: bankTotalUSD,
                    investments: investmentsTotalUSD,
                    debts: debtTotalPendingUSD,
                    rentalsIncome: monthlyRentalIncomeUSD
                }
            },
            create: {
                month,
                year,
                totalNetWorthUSD,
                totalIncomeUSD: monthlyRentalIncomeUSD,
                snapshotData: {
                    bank: bankTotalUSD,
                    investments: investmentsTotalUSD,
                    debts: debtTotalPendingUSD,
                    rentalsIncome: monthlyRentalIncomeUSD
                }
            }
        });

        // 5. Send Email
        if (process.env.RESEND_API_KEY && recipientEmail) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const emailList = recipientEmail.split(',').map(e => e.trim()).filter(e => e);

            await resend.emails.send({
                from: 'Passive Income Tracker <onboarding@resend.dev>',
                to: emailList,
                subject: `Resumen Mensual: ${month}/${year}${force ? ' (Prueba)' : ''}`,
                html: `
                    <h1>Resumen Mensual - ${month}/${year}</h1>
                    <p>Aquí tienes el estado actual de tus inversiones:</p>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px;"><strong>Patrimonio Total (Net Worth)</strong></td>
                            <td style="padding: 10px; text-align: right; color: #10b981; font-size: 18px;"><strong>${formatUSD(totalNetWorthUSD)}</strong></td>
                        </tr>
                         <tr>
                            <td style="padding: 10px;">Banco / Liquidez</td>
                            <td style="padding: 10px; text-align: right;">${formatUSD(bankTotalUSD)}</td>
                        </tr>
                         <tr>
                            <td style="padding: 10px;">Inversiones (ON/Treasury)</td>
                            <td style="padding: 10px; text-align: right;">${formatUSD(investmentsTotalUSD)}</td>
                        </tr>
                         <tr>
                            <td style="padding: 10px;">Deudas a Cobrar</td>
                            <td style="padding: 10px; text-align: right;">${formatUSD(debtTotalPendingUSD)}</td>
                        </tr>
                    </table>

                    <br/>
                    <h3>Renta Estimada Mensual</h3>
                     <p>Alquileres Activos (USD): <strong>${formatUSD(monthlyRentalIncomeUSD)}</strong></p>

                    <p style="font-size: 12px; color: #888;">Generado automáticamente por Passive Income Tracker.</p>
                `
            });
        }

        return NextResponse.json({ success: true, description: force ? 'Manual Trigger Sent' : 'Scheduled Run', snapshot, sentTo: recipientEmail });

    } catch (error) {
        console.error('Cron Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
