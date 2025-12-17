
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { targetMonth, targetYear } = await req.json();
        const year = parseInt(targetYear);
        const month = parseInt(targetMonth); // 1-12

        // Fetch active rules
        const rules = await prisma.barbosaRecurrence.findMany({
            where: { userId, active: true }
        });

        if (rules.length === 0) {
            return NextResponse.json({ message: 'No active rules found' }, { status: 400 });
        }

        let createdCount = 0;

        for (const rule of rules) {
            // Calculate date: Year/Month/RuleDay.
            // Handle day overflow (e.g. Feb 31 -> Feb 28/29)
            // Actually, Date constructor handles overflow by default (Feb 30 -> Mar 2), but typically for monthly bills we want "End of Month" if it exceeds.

            // Logic: Try to set day. If result month != target month, clamp to last day of target month.
            let date = new Date(year, month - 1, rule.dayOfMonth);
            if (date.getMonth() !== month - 1) {
                date = new Date(year, month, 0); // Last day of target month
            }

            await prisma.barbosaTransaction.create({
                data: {
                    userId,
                    date: date,
                    type: rule.type,
                    amount: rule.amount,
                    currency: rule.currency,
                    categoryId: rule.categoryId,
                    subCategoryId: rule.subCategoryId,
                    description: `(Auto) ${rule.name}`,
                    status: 'PROJECTED',
                    amountUSD: rule.currency === 'USD' ? rule.amount : null // Can't calc USD without rate, leave null or fetch rate? Leave null or handle later.
                }
            });
            createdCount++;
        }

        return NextResponse.json({ success: true, count: createdCount });

    } catch (error: any) {
        console.error('Recurrence Apply Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
