import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { calculateXIRR } from '@/lib/financial';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
  try {
    const userId = await getUserId();
    // Get all ON investments that have at least one transaction (purchase) And belong to user
    const investments = await prisma.investment.findMany({
      where: {
        userId,
        type: 'ON',
        transactions: {
          some: {
            type: 'BUY'
          }
        }
      },
      include: {
        transactions: {
          where: { type: 'BUY' }
        },
        cashflows: {
          where: { status: 'PROJECTED' },
          orderBy: { date: 'asc' }
        }
      }
    });

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

      return {
        ticker: inv.ticker,
        name: inv.name,
        invested,
        percentage: capitalInvertido > 0 ? (invested / capitalInvertido) * 100 : 0,
        tir: tir ? tir * 100 : 0
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
      totalONs: investments.length,
      totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0)
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return unauthorized();
  }
}
