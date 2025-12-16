import { prisma } from '@/lib/prisma';
import { InvestmentsDashboardView } from '@/components/on/InvestmentsDashboardView';
import { notFound } from 'next/navigation';
import { calculateXIRR } from '@/lib/financial';
import { calculateFIFO } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: {
        userId: string;
    };
    searchParams: {
        secret?: string;
    };
}

export default async function InvestmentsPrintPage({ params, searchParams }: PageProps) {
    if (searchParams.secret !== process.env.CRON_SECRET) {
        return notFound();
    }

    const { userId } = params;

    // --- Data Fetching Logic (Adapted from /api/investments/on/dashboard) ---
    const investments = await prisma.investment.findMany({
        where: {
            userId,
            market: 'ARG',
            transactions: {
                some: {}
            }
        },
        include: {
            transactions: true,
            cashflows: {
                where: { status: 'PROJECTED' },
                orderBy: { date: 'asc' }
            }
        }
    });

    const investmentIds = investments.map(i => i.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentPrices = await prisma.assetPrice.findMany({
        where: {
            investmentId: { in: investmentIds },
            date: { gte: weekAgo }
        },
        orderBy: { date: 'desc' }
    });

    const priceMap: Record<string, number> = {};
    recentPrices.forEach(p => {
        if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price;
    });

    let totalRealized = 0;
    let totalUnrealized = 0;
    let totalCostRealized = 0;
    let totalCostUnrealized = 0;
    let hasEquity = false;

    for (const inv of investments) {
        if (!['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(inv.type || '')) {
            hasEquity = true;
        }

        const fifoTxs = inv.transactions.map(t => ({
            id: t.id,
            date: t.date,
            type: t.type as 'BUY' | 'SELL',
            quantity: t.quantity,
            price: t.price,
            commission: t.commission,
            currency: t.currency
        }));

        const result = calculateFIFO(fifoTxs, inv.ticker);

        result.realizedGains.forEach(g => {
            totalRealized += g.gainAbs;
            totalCostRealized += (g.buyPriceAvg * g.quantity) + g.buyCommissionPaid;
        });

        let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;
        if (inv.type === 'ON' || inv.type === 'CORPORATE_BOND') {
            currentPrice = currentPrice / 100;
        }

        result.openPositions.forEach(p => {
            const cost = (p.quantity * p.buyPrice) + p.buyCommission;
            const value = p.quantity * currentPrice;
            if (currentPrice > 0) {
                totalUnrealized += (value - cost);
                totalCostUnrealized += cost;
            }
        });
    }

    const roiRealized = totalCostRealized !== 0 ? (totalRealized / totalCostRealized) * 100 : 0;
    const roiUnrealized = totalCostUnrealized !== 0 ? (totalUnrealized / totalCostUnrealized) * 100 : 0;

    const capitalInvertido = investments.reduce((sum, inv) => {
        const invTotal = inv.transactions.reduce((txSum, tx) => txSum + Math.abs(tx.totalAmount), 0);
        return sum + invTotal;
    }, 0);

    const today = new Date();
    let capitalCobrado = 0;
    let interesCobrado = 0;
    let capitalACobrar = 0;
    let interesACobrar = 0;

    investments.forEach(inv => {
        inv.cashflows.forEach(cf => {
            const cfDate = new Date(cf.date);
            const isPast = cfDate <= today;

            if (cf.type === 'AMORTIZATION') {
                if (isPast) capitalCobrado += cf.amount;
                else capitalACobrar += cf.amount;
            } else if (cf.type === 'INTEREST') {
                if (isPast) interesCobrado += cf.amount;
                else interesACobrar += cf.amount;
            }
        });
    });

    const totalRetorno = (capitalCobrado + interesCobrado + capitalACobrar + interesACobrar);
    const gananciaTotal = totalRetorno - capitalInvertido;
    const roi = capitalInvertido > 0 ? (gananciaTotal / capitalInvertido) * 100 : 0;

    const allFutureCashflows = investments.flatMap(inv =>
        inv.cashflows
            .filter(cf => new Date(cf.date) > today)
            .map(cf => ({
                date: cf.date.toISOString(), // Ensure serializable
                amount: cf.amount,
                type: cf.type,
                ticker: inv.ticker,
                name: inv.name,
                description: cf.description
            }))
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const proximoPago = allFutureCashflows.length > 0 ? allFutureCashflows[0] : null;

    const twelveMonthsFromNow = new Date();
    twelveMonthsFromNow.setMonth(twelveMonthsFromNow.getMonth() + 12);

    const upcomingPayments = allFutureCashflows
        .filter(cf => new Date(cf.date) <= twelveMonthsFromNow)
        .slice(0, 50);

    const portfolioBreakdown = investments.map(inv => {
        const invested = inv.transactions.reduce((sum, tx) => sum + Math.abs(tx.totalAmount), 0);
        const amounts: number[] = [];
        const dates: Date[] = [];

        inv.transactions.forEach(tx => {
            amounts.push(-Math.abs(tx.totalAmount));
            dates.push(new Date(tx.date));
        });

        inv.cashflows.forEach(cf => {
            amounts.push(cf.amount);
            dates.push(new Date(cf.date));
        });

        const tir = calculateXIRR(amounts, dates);

        let theoreticalTir: number | null = null;
        let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;
        if (inv.type === 'ON' || inv.type === 'CORPORATE_BOND') {
            if (currentPrice > 2.0) currentPrice = currentPrice / 100;
        }

        if (currentPrice > 0) {
            const fifoTxs = inv.transactions.map(t => ({
                id: t.id,
                date: new Date(t.date),
                type: t.type as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: t.price,
                commission: t.commission,
                currency: t.currency
            }));
            const fifoResult = calculateFIFO(fifoTxs, inv.ticker);
            const totalHolding = fifoResult.openPositions.reduce((s, p) => s + p.quantity, 0);

            if (totalHolding > 0) {
                const marketValue = totalHolding * currentPrice;
                const flows = [-marketValue];
                const flowDates = [new Date()];
                inv.cashflows.forEach(cf => {
                    flows.push(cf.amount);
                    flowDates.push(new Date(cf.date));
                });
                const marketTir = calculateXIRR(flows, flowDates);
                if (marketTir) theoreticalTir = marketTir * 100;
            }
        }

        return {
            ticker: inv.ticker,
            name: inv.name,
            invested,
            percentage: capitalInvertido > 0 ? (invested / capitalInvertido) * 100 : 0,
            tir: tir ? tir * 100 : 0,
            theoreticalTir: theoreticalTir,
            type: inv.type
        };
    }).filter(item => item.invested > 0);

    const allAmounts: number[] = [];
    const allDates: Date[] = [];
    investments.forEach(inv => {
        inv.transactions.forEach(tx => {
            if (tx.type === 'BUY') {
                allAmounts.push(-Math.abs(tx.totalAmount));
                allDates.push(new Date(tx.date));
            }
        });
        inv.cashflows.forEach(cf => {
            allAmounts.push(cf.amount);
            allDates.push(new Date(cf.date));
        });
    });

    const tirConsolidada = calculateXIRR(allAmounts, allDates);
    const totalACobrar = capitalACobrar + interesACobrar;

    const dashboardData = {
        capitalInvertido,
        capitalCobrado,
        interesCobrado,
        capitalACobrar,
        interesACobrar,
        totalACobrar,
        roi,
        tirConsolidada: tirConsolidada ? tirConsolidada * 100 : 0,
        proximoPago,
        upcomingPayments,
        portfolioBreakdown,
        totalONs: investments.filter(i => ['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(i.type || '')).length,
        totalInvestments: investments.length,
        totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
        pnl: hasEquity ? {
            realized: totalRealized,
            realizedPercent: roiRealized,
            unrealized: totalUnrealized,
            unrealizedPercent: roiUnrealized,
            hasEquity: true
        } : null
    };

    return (
        <div className="p-8 bg-slate-950 min-h-screen text-slate-100 print:bg-white print:text-black">
            <style>{`
                @page {
                    size: A4;
                    margin: 10mm;
                }
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            `}</style>
            <div className="mb-8 print:mb-4 border-b border-slate-800 print:border-slate-300 pb-4">
                <h1 className="text-2xl font-bold text-white print:text-slate-900">Reporte de Inversiones</h1>
                <p className="text-slate-400 print:text-slate-600">
                    {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                </p>
            </div>

            <InvestmentsDashboardView data={dashboardData} showValues={true} onTogglePrivacy={() => { }} hidePrivacyControls={true} />
        </div>
    );
}
