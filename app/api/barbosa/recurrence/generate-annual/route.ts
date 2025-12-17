
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            description,
            totalAmount,
            year,
            frequency, // MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUALLY, ANNUALLY
            startMonth, // 1-12
            categoryId,
            subCategoryId,
            currency,
            dayOfMonth = 10
        } = body;

        const targetYear = parseInt(year);
        const amountTotal = parseFloat(totalAmount);

        let intervalMonths = 1;
        switch (frequency) {
            case 'MONTHLY': intervalMonths = 1; break;
            case 'BIMONTHLY': intervalMonths = 2; break;
            case 'QUARTERLY': intervalMonths = 3; break;
            case 'SEMIANNUALLY': intervalMonths = 6; break;
            case 'ANNUALLY': intervalMonths = 12; break;
            default: intervalMonths = 1;
        }

        // Calculate installment amount
        // Number of installments depends on how many fit in the year starting from startMonth
        // Logic: Iterate from startMonth until end of year, stepping by intervalMonths.
        // Wait, user said: "Total of 120k payable monthly = 10k/mo".
        // "Total 120k payable bimonthly = 20k/bi-mo? Or 6 installments of X?"
        // Usually, Total Amount represents the ANNUAL Total.
        // So Per-Installment = Total / (12 / interval). This assumes full coverage.
        // But if I start in July, do I pay half?
        // Let's assume the "Total Amount" provided is the TOTAL TO BE DISTRIBUTED across the calculated installments.

        // Let's calculate actual installments first
        const installments = [];
        let currentMonth = parseInt(startMonth); // 1-based

        while (currentMonth <= 12) {
            installments.push(currentMonth);
            currentMonth += intervalMonths;
        }

        const count = installments.length;
        if (count === 0) return NextResponse.json({ error: 'No installments fit in the selected period' }, { status: 400 });

        const amountPerInstallment = amountTotal / count;

        let createdCount = 0;

        for (const month of installments) {
            const date = new Date(targetYear, month - 1, dayOfMonth);

            await prisma.barbosaTransaction.create({
                data: {
                    userId,
                    date: date,
                    type: 'EXPENSE',
                    amount: amountPerInstallment,
                    currency,
                    categoryId,
                    subCategoryId: subCategoryId || null,
                    description: `(Auto Anual) ${description} (${createdCount + 1}/${count})`,
                    status: 'PROJECTED',
                    amountUSD: currency === 'USD' ? amountPerInstallment : null
                }
            });
            createdCount++;
        }

        return NextResponse.json({ success: true, count: createdCount, amountPerInstallment });

    } catch (error: any) {
        console.error('Annual Generator Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
