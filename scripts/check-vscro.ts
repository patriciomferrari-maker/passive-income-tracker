import { prisma } from '../lib/prisma';

async function checkVSCROCashflows() {
    try {
        // Get VSCRO investment
        const vscro = await prisma.investment.findFirst({
            where: { ticker: 'VSCRO' },
            include: {
                amortizationSchedules: { orderBy: { paymentDate: 'asc' } },
                cashflows: {
                    where: { status: 'PROJECTED' },
                    orderBy: { date: 'asc' }
                }
            }
        });

        if (!vscro) {
            console.log('VSCRO not found');
            return;
        }

        console.log('\n=== VSCRO Investment ===');
        console.log('Ticker:', vscro.ticker);
        console.log('Amortization Type:', vscro.amortization);
        console.log('Maturity Date:', vscro.maturityDate);
        console.log('Frequency:', vscro.frequency, 'months');

        console.log('\n=== Amortization Schedules ===');
        console.log('Total schedules:', vscro.amortizationSchedules.length);
        vscro.amortizationSchedules.forEach((sch, i) => {
            console.log(`${i + 1}. Date: ${sch.paymentDate.toISOString().split('T')[0]}, Percentage: ${sch.percentage * 100}%`);
        });

        console.log('\n=== Generated Cashflows ===');
        console.log('Total cashflows:', vscro.cashflows.length);

        const byType = vscro.cashflows.reduce((acc, cf) => {
            acc[cf.type] = (acc[cf.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('By type:', byType);

        console.log('\n=== Amortization Cashflows ===');
        const amortizations = vscro.cashflows.filter(cf => cf.type === 'AMORTIZATION');
        amortizations.forEach((cf, i) => {
            console.log(`${i + 1}. Date: ${cf.date.toISOString().split('T')[0]}, Amount: $${cf.amount.toFixed(2)}, Description: ${cf.description}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkVSCROCashflows();
