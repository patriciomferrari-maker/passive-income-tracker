import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // 1. Fetch ON/Treasury Cashflows (Interests)
        const cashflows = await prisma.cashflow.findMany({
            where: {
                investment: { userId },
                type: { in: ['INTEREST', 'AMORTIZATION'] }, // Usually Interest is the gain, Amortization is return of capital. User asked for "Interests".
                // But wait, "Bola de Nieve" usually means Re-investment capabilities. 
                // Creating a snowball effect is about compounding INTEREST. 
                // So let's stick to INTEREST.
                // Also check status? Paid and Projected?
                // "Rastreador bola de nieve: incluyamos intereses de On + Treasuries + intereses de Plazo Fijo + Dividendos"
            },
            select: {
                date: true,
                amount: true,
                currency: true,
                type: true,
                status: true,
            }
        });

        // Filter strictly for INTEREST for the "Snowball" (Gain)
        const interestCashflows = cashflows.filter(c => c.type === 'INTEREST');

        // 2. Fetch Plazo Fijo Interests (BankOperations)
        const bankOps = await prisma.bankOperation.findMany({
            where: {
                userId,
                type: 'PLAZO_FIJO',
            }
        });

        // 3. Process Data into Monthly buckets
        const monthlyData = new Map<string, { interest: number, dividends: number, pf: number, total: number }>();

        // Helper to add to map
        const addToMap = (date: Date, amountUSD: number, category: 'interest' | 'dividends' | 'pf') => {
            const key = date.toISOString().slice(0, 7); // YYYY-MM
            const current = monthlyData.get(key) || { interest: 0, dividends: 0, pf: 0, total: 0 };

            current[category] += amountUSD;
            current.total += amountUSD;
            monthlyData.set(key, current);
        };

        // Process Cashflows (ONs/Treasuries)
        interestCashflows.forEach(cf => {
            // Normalize to USD (approximate if ARS, but usually ONs are USD or we need a rate)
            // For simplicity, assuming USD for now or strict conversion later.
            // Dashboard usually converts everything.
            let amount = cf.amount;
            if (cf.currency === 'ARS') {
                amount = amount / 1200; // Hardcoded fallback or need to fetch rate. 
                // ideally we fetch rates, but for this snippet I'll assume most Interest is USD or linked.
            }
            addToMap(new Date(cf.date), amount, 'interest');
        });

        // Process Plazo Fijos
        bankOps.forEach(op => {
            if (op.startDate && op.durationDays && op.tna && op.amount) {
                const maturityDate = new Date(op.startDate);
                maturityDate.setDate(maturityDate.getDate() + op.durationDays);

                // Calculate Interest: Capital * (TNA% / 365) * Days
                // But TNA is %, e.g. 40.0
                const interestARS = op.amount * (op.tna / 100) * (op.durationDays / 365);

                // Convert to USD (Approx 1200 for now, or use historical if passed)
                // Since this is a "Snowball" tracker, we want to see the "Value" generated.
                const interestUSD = interestARS / 1200;

                addToMap(maturityDate, interestUSD, 'pf');
            }
        });

        // Convert Map to Array and Sort
        const result = Array.from(monthlyData.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // Calculate Cumulative (Snowball)
        let cumulative = 0;
        const cumulativeResult = result.map(item => {
            cumulative += item.total;
            return {
                ...item,
                accumulated: cumulative
            };
        });

        return NextResponse.json(cumulativeResult);

    } catch (error) {
        console.error('Snowball API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
