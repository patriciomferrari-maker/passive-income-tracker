import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { calculateXIRR } from '@/lib/financial';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { calculateFIFO } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getUserId();
    // Get all ON investments that have at least one transaction (purchase) And belong to user
    const investments = await prisma.investment.findMany({
      where: {
        userId,
        market: 'ARG', // Strict filter: Only Argentina Portfolio
        transactions: {
          some: {} // Any transaction
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

    // --- P&L CALCULATION (Adapted from Positions API) ---
    // We need to calculate Realized and Unrealized gains for ALL assets
    // This allows us to conditionally show the P&L cards in the Dashboard

    // Fetch Last Prices (Simplified: fetch all recent prices for these investments)
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

    // We need a lightweight FIFO here or just simple avg cost if FIFO is too heavy?
    // Let's import calculateFIFO to be consistent.
    // We need to shape transactions for FIFO.

    for (const inv of investments) {
      // Check if Equity
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

      // Import dynamically to avoid circular deps if any, or just import at top?
      // calculateFIFO is pure, so safe.
      // We'll calculate localized P&L. 
      const result = calculateFIFO(fifoTxs, inv.ticker);

      // REALIZED
      result.realizedGains.forEach(g => {
        totalRealized += g.gainAbs;
        // Cost basis for realized = Sell Proceeds - Gain
        // Or avgBuyPrice * quantity
        totalCostRealized += (g.buyPriceAvg * g.quantity) + g.buyCommissionPaid;
      });

      // UNREALIZED
      // We need current price
      let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;

      // If ON/Bond, verify price format (simulating PositionsTable logic)
      // Usually Dashboard handles ONs naturally, but if we have mixed types...
      // PositionsTable divides ON price by 100. Let's assume stored price is raw.
      if (inv.type === 'ON' || inv.type === 'CORPORATE_BOND') {
        currentPrice = currentPrice / 100;
      }

      result.openPositions.forEach(p => {
        const cost = (p.quantity * p.buyPrice) + p.buyCommission;
        // Handle ON price division if needed (simulated above)
        const value = p.quantity * currentPrice;
        if (currentPrice > 0) {
          totalUnrealized += (value - cost);
          totalCostUnrealized += cost;
        }
      });
    }

    const roiRealized = totalCostRealized !== 0 ? (totalRealized / totalCostRealized) * 100 : 0;
    const roiUnrealized = totalCostUnrealized !== 0 ? (totalUnrealized / totalCostUnrealized) * 100 : 0;


    // Calculate capital invertido (total invested)
    const capitalInvertido = investments.reduce((sum, inv) => {
      const invTotal = inv.transactions.reduce((txSum, tx) => txSum + Math.abs(tx.totalAmount), 0);
      return sum + invTotal;
    }, 0);

    // Split cashflows into Past (Collected) and Future (Projected)
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

    // Calculate ROI (Return on Investment)
    // ROI = (Total Ganancia / Total Invertido) * 100
    // Total Ganancia = (Cobrado + A Cobrar) - Invertido
    const totalRetorno = (capitalCobrado + interesCobrado + capitalACobrar + interesACobrar);
    const gananciaTotal = totalRetorno - capitalInvertido;
    const roi = capitalInvertido > 0 ? (gananciaTotal / capitalInvertido) * 100 : 0;

    // Get próximo pago (next payment)
    const allFutureCashflows = investments.flatMap(inv =>
      inv.cashflows
        .filter(cf => new Date(cf.date) > today)
        .map(cf => ({
          date: cf.date,
          amount: cf.amount,
          type: cf.type,
          ticker: inv.ticker,
          name: inv.name,
          description: cf.description
        }))
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const proximoPago = allFutureCashflows.length > 0 ? allFutureCashflows[0] : null;

    // Get upcoming payments for chart (next 12 months)
    const twelveMonthsFromNow = new Date();
    twelveMonthsFromNow.setMonth(twelveMonthsFromNow.getMonth() + 12);

    const upcomingPayments = allFutureCashflows
      .filter(cf => new Date(cf.date) <= twelveMonthsFromNow)
      .slice(0, 50); // Limit to 50 payments for performance

    // Calculate portfolio breakdown and TIR
    const portfolioBreakdown = investments.map(inv => {
      const invested = inv.transactions.reduce((sum, tx) => sum + Math.abs(tx.totalAmount), 0);

      // Calculate TIR
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

      // Calculate Theoretical TIR (market-based)
      let theoreticalTir: number | null = null;
      let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;

      // Apply same price normalization as positions API
      if (inv.type === 'ON' || inv.type === 'CORPORATE_BOND') {
        if (currentPrice > 2.0) currentPrice = currentPrice / 100;
      }

      if (currentPrice > 0) {
        // Calculate total holding from open positions (using FIFO)
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

    // Calculate Consolidated TIR (XIRR)
    const allAmounts: number[] = [];
    const allDates: Date[] = [];

    investments.forEach(inv => {
      // Add all BUY transactions as negative cashflows
      inv.transactions.forEach(tx => {
        if (tx.type === 'BUY') {
          allAmounts.push(-Math.abs(tx.totalAmount));
          allDates.push(new Date(tx.date));
        }
      });

      // Add all projected cashflows as positive cashflows
      inv.cashflows.forEach(cf => {
        allAmounts.push(cf.amount);
        allDates.push(new Date(cf.date));
      });
    });

    const tirConsolidada = calculateXIRR(allAmounts, allDates);

    // Calculate total a cobrar (capital + interés)
    const totalACobrar = capitalACobrar + interesACobrar;

    return NextResponse.json({
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
      totalONs: investments.filter(i => ['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(i.type || '')).length, // Real bond count
      totalInvestments: investments.length, // Total count including equities
      totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
      // P&L Data for Cards
      pnl: hasEquity ? {
        realized: totalRealized,
        realizedPercent: roiRealized,
        unrealized: totalUnrealized,
        unrealizedPercent: roiUnrealized,
        hasEquity: true
      } : null
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }

    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
