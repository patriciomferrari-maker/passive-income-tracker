import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { calculateXIRR } from '@/lib/financial';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { calculateFIFO } from '@/app/lib/fifo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = await getUserId();

    // === VALIDATION CONTROL: Fetch Positions (Tenencia) for Source of Truth ===
    // Instead of duplicating logic, we call the Positions API internally
    const positionsUrl = new URL('/api/investments/positions', request.url);
    positionsUrl.searchParams.set('market', 'ARG');
    positionsUrl.searchParams.set('currency', 'USD');

    const positionsRes = await fetch(positionsUrl.toString(), {
      headers: { cookie: request.headers.get('cookie') || '' }
    });

    if (!positionsRes.ok) {
      throw new Error('Failed to fetch positions for validation');
    }

    const positions = await positionsRes.json();

    // Calculate Tenencia Totals (Source of Truth)
    const tenenciaTotalInversion = positions.reduce((sum: number, p: any) =>
      sum + (p.quantity * p.buyPrice + p.buyCommission), 0
    );
    const tenenciaTotalValorActual = positions.reduce((sum: number, p: any) =>
      sum + (p.quantity * (p.sellPrice || 0) || 0), 0
    );

    console.log('📊 DASHBOARD VALIDATION CONTROL:');
    console.log(`  ✓ Tenencia Total Inversión: $${tenenciaTotalInversion.toFixed(2)} USD`);
    console.log(`  ✓ Tenencia Total Valor Actual: $${tenenciaTotalValorActual.toFixed(2)} USD`);

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
          // REMOVED status filter - we need ALL cashflows (past + future) for TIR
          orderBy: { date: 'asc' }
        }
      }
    });

    // === USE TENENCIA VALUES AS AUTHORITATIVE ===
    const capitalInvertido = tenenciaTotalInversion;
    let totalCurrentValue = tenenciaTotalValorActual;

    // Fetch Historical Exchange Rates (TC_USD_ARS)
    const rates = await prisma.economicIndicator.findMany({
      where: { type: 'TC_USD_ARS' },
      orderBy: { date: 'desc' }
    });

    // Helper to find closest rate (needed for Consolidated TIR calculation)
    const getExchangeRate = (date: Date): number => {
      const rate = rates.find(r => r.date <= date);
      if (rate) return rate.value;
      if (rates.length > 0) return rates[rates.length - 1].value;
      return 1200; // Fallback
    };

    // Calculate P&L from Positions
    const totalRealized = positions
      .filter((p: any) => p.status === 'CLOSED')
      .reduce((sum: number, p: any) => sum + (p.resultAbs || 0), 0);

    const totalUnrealized = positions
      .filter((p: any) => p.status === 'OPEN')
      .reduce((sum: number, p: any) => sum + (p.resultAbs || 0), 0);

    const hasEquity = positions.some((p: any) => {
      const t = (p.type || '').toUpperCase();
      return !['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(t);
    });


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
        const isProjected = cf.status === 'PROJECTED'; // Only count projected ones for UI

        if (!isProjected) return; // Skip non-projected for UI metrics

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

    // Get próximo pago (next payment) - only from PROJECTED cashflows
    const allFutureCashflows = investments.flatMap(inv =>
      inv.cashflows
        .filter(cf => cf.status === 'PROJECTED' && new Date(cf.date) > today)
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

      // Theoretical TIR is calculated in Positions API, we use positions data
      const positionsForTicker = positions.filter((p: any) => p.ticker === inv.ticker && p.status === 'OPEN');
      const theoreticalTir = positionsForTicker.length > 0 && positionsForTicker[0].theoreticalTir
        ? positionsForTicker[0].theoreticalTir
        : null;

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

      // Add ALL cashflows (not just projected) - both past and future
      // These are typically in USD for Hard Dollar bonds
      inv.cashflows.forEach(cf => {
        let amount = cf.amount;
        // Only convert if the bond itself is ARS denominated
        if (inv.currency === 'ARS') {
          // For past cashflows, use historical rate; for future, use current rate
          const cfDate = new Date(cf.date);
          const rate = cfDate <= new Date() ? getExchangeRate(cfDate) : getExchangeRate(new Date());
          if (rate > 0) amount = amount / rate;
        }
        allAmounts.push(amount);
        allDates.push(new Date(cf.date));
      });
    });

    console.log('🧮 TIR CONSOLIDADA DEBUG:');
    console.log(`  Total flows: ${allAmounts.length}`);
    console.log(`  Sample amounts (first 5): ${allAmounts.slice(0, 5).map(a => a.toFixed(2)).join(', ')}`);
    console.log(`  Sum of outflows (negative): $${allAmounts.filter(a => a < 0).reduce((s, a) => s + a, 0).toFixed(2)}`);
    console.log(`  Sum of inflows (positive): $${allAmounts.filter(a => a > 0).reduce((s, a) => s + a, 0).toFixed(2)}`);

    const tirConsolidada = calculateXIRR(allAmounts, allDates);
    console.log(`  Calculated TIR: ${tirConsolidada ? (tirConsolidada * 100).toFixed(2) : 'NULL'}%`);

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
      totalONs: investments.filter(i => ['ON', 'CORPORATE_BOND', 'TREASURY', 'BONO'].includes(i.type || '')).length,
      totalInvestments: investments.length,
      totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0),
      // P&L Data for Cards (using Tenencia values)
      totalCurrentValue: totalCurrentValue, // Already set from Tenencia
      pnl: hasEquity ? {
        realized: totalRealized,
        realizedPercent: capitalInvertido > 0 ? (totalRealized / capitalInvertido) * 100 : 0,
        unrealized: totalUnrealized,
        unrealizedPercent: capitalInvertido > 0 ? (totalUnrealized / capitalInvertido) * 100 : 0,
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
