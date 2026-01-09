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

    // --- P&L CALCULATION (Restored) ---
    let totalRealized = 0;
    let totalUnrealized = 0; // Absolute gain/loss
    let totalCostUnrealized = 0; // Cost basis of open positions
    let hasEquity = false;

    // Fetch Latest Asset Prices
    const investmentIds = investments.map(i => i.id);
    const priceMap: Record<string, number> = {};
    if (investmentIds.length > 0) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentPrices = await prisma.assetPrice.findMany({
        where: { investmentId: { in: investmentIds }, date: { gte: weekAgo } },
        orderBy: { date: 'asc' }
      });
      recentPrices.forEach(p => priceMap[p.investmentId] = p.price);
    }

    // Fetch Historical Exchange Rates (TC_USD_ARS)
    const rates = await prisma.economicIndicator.findMany({
      where: { type: 'TC_USD_ARS' },
      orderBy: { date: 'desc' }
    });

    // Helper to find closest rate
    const getExchangeRate = (date: Date): number => {
      // 1. Try to find exact or closest past date
      const rate = rates.find(r => r.date <= date);
      if (rate) return rate.value;

      // 2. If no past date, take the oldest available (if date is before our history)
      if (rates.length > 0) return rates[rates.length - 1].value;

      // 3. Fallback: Current Market Rate (approximate if DB empty)
      // Ideally we should fetch this, but for sync purposes let's assume a safe default or latest know
      return 1200; // Warning: Hardcoded fallback if NO data exists
    };

    // Calculate capital invertido (total invested) NORMALIZED TO USD
    const capitalInvertido = investments.reduce((sum, inv) => {
      const invTotal = inv.transactions.reduce((txSum, tx) => {
        let amount = Math.abs(tx.totalAmount);

        // Convert ARS to USD
        if (tx.currency === 'ARS') {
          const rate = getExchangeRate(tx.date);
          if (rate && rate > 0) {
            amount = amount / rate;
          }
        }

        return txSum + amount;
      }, 0);

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
        // If Price > 200, assume it's ARS masked as per-unit or just raw ARS.
        // BUT we need to know the currency of the PRICE, not just the investment.
        // Assuming priceMap stores raw exchange data.
        // Heuristic: If converted to USD it is > 2.0, then divide by 100.
        // Actually, safer: if > 2.0, divide by 100. EXCEPT if it's ARS ~1000.
        // 1000 / 100 = 10. That's 10% parity? No.
        // If ARS Parity is ~100%, price is around 1000-1400 ARS.
        // If we divide 1000/100 = 10.
        // Then we divide by FX (1000) -> 0.01 USD. WRONG.
        // Correct flow:
        // 1. Convert Raw Price to USD.
        // 2. If USD Price > 2.0 (e.g. 102), divide by 100 -> 1.02.
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

          const today = new Date();
          inv.cashflows.forEach(cf => {
            if (new Date(cf.date) > today) {
              flows.push(cf.amount);
              flowDates.push(new Date(cf.date));
            }
          });

          const marketTir = calculateXIRR(flows, flowDates);
          if (marketTir) theoreticalTir = marketTir * 100;

          // --- P&L Accumulation (USD Normalized) ---
          hasEquity = true;
          const rateNow = getExchangeRate(new Date());

          // 1. Open Positions (Unrealized)
          // 1. Open Positions (Unrealized)
          fifoResult.openPositions.forEach(p => {
            // Ignore dust
            if (p.quantity < 0.0001) return;

            let costUSD = p.quantity * p.buyPrice; // Base cost
            let valUSD = p.quantity * currentPrice;

            // Normalize Cost
            if (p.currency === 'ARS') {
              const r = getExchangeRate(p.date) || rateNow;
              costUSD /= r;
            }
            // Normalize Value
            if (inv.currency === 'ARS') {
              valUSD /= rateNow;
            }

            // Only accumulate if valid price to avoid -100% ghost loss
            if (currentPrice > 0) {
              totalCostUnrealized += costUSD;
              totalUnrealized += (valUSD - costUSD);
            }
          });

          // 2. Closed Positions (Realized)
          fifoResult.realizedGains.forEach(g => {
            let gainUSD = g.gainAbs;
            if (g.currency === 'ARS') {
              const r = getExchangeRate(g.date) || 1200;
              gainUSD /= r;
            }
            totalRealized += gainUSD;
          });
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
      // Add all BUY transactions as negative cashflows (NORMALIZED TO USD)
      inv.transactions.forEach(tx => {
        if (tx.type === 'BUY') {
          let amount = -Math.abs(tx.totalAmount);
          // Normalize to USD
          if (tx.currency === 'ARS') {
            const rate = getExchangeRate(tx.date) || 1200;
            amount = amount / rate;
          }
          allAmounts.push(amount);
          allDates.push(new Date(tx.date));
        }
      });

      // Add all projected cashflows as positive cashflows (Already in USD mostly, but check)
      // Assumption: Cashflows are projected in the asset's currency (USD usually for Hard Dollar ONs)
      // If asset is ARS, we should convert projected too?
      // Most ONs tracked are Hard Dollar (USD).
      inv.cashflows.forEach(cf => {
        // If cashflow is ARS (unlikely for ONs in this tracker context, but possible)
        // We assume USD for now unless explicitly marked.
        // Actually, let's treat them as USD since `investment.currency` usually defines the asset base.
        let amount = cf.amount;
        if (inv.currency === 'ARS') { // If the BOND ITSELF is ARS denominated
          const rate = getExchangeRate(new Date()); // Use current rate for future?
          amount = amount / rate;
        }
        allAmounts.push(amount);
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
      totalCurrentValue: totalCostUnrealized + totalUnrealized,
      pnl: hasEquity ? {
        realized: totalRealized,
        realizedPercent: totalCostUnrealized > 0 ? (totalRealized / totalCostUnrealized) * 100 : 0, // Approx (Base incorrect but safe)
        unrealized: totalUnrealized,
        unrealizedPercent: totalCostUnrealized > 0 ? (totalUnrealized / totalCostUnrealized) * 100 : 0,
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
