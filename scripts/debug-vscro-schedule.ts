import { prisma } from '../lib/prisma';
import { addMonths } from '../lib/financial';

async function debugVSCROSchedule() {
    try {
        const vscro = await prisma.investment.findFirst({
            where: { ticker: 'VSCRO' },
            include: {
                amortizationSchedules: { orderBy: { paymentDate: 'asc' } }
            }
        });

        if (!vscro) {
            console.log('VSCRO not found');
            return;
        }

        console.log('\n=== VSCRO Details ===');
        console.log('Maturity Date:', vscro.maturityDate);
        console.log('Emission Date:', vscro.emissionDate);
        console.log('Frequency:', vscro.frequency, 'months');

        // Generate schedule dates (same logic as investments.ts)
        const maturityDate = new Date(vscro.maturityDate!);
        const emissionDate = vscro.emissionDate ? new Date(vscro.emissionDate) : null;
        const freqMonths = vscro.frequency!;
        const stopDate = emissionDate || addMonths(maturityDate, -24);

        const scheduleDates: Date[] = [];
        let currentDate = new Date(maturityDate);
        let guard = 0;

        while (guard < 500) {
            scheduleDates.unshift(new Date(currentDate));
            const prevDate = addMonths(currentDate, -freqMonths);
            if (prevDate < stopDate && !emissionDate) break;
            if (emissionDate && prevDate < emissionDate) break;
            currentDate = prevDate;
            guard++;
        }

        console.log('\n=== Generated Period Dates ===');
        console.log('Total periods:', scheduleDates.length);
        scheduleDates.forEach((date, i) => {
            console.log(`${i + 1}. ${date.toISOString().split('T')[0]}`);
        });

        console.log('\n=== Amortization Schedules ===');
        vscro.amortizationSchedules.forEach((sch, i) => {
            const schDate = new Date(sch.paymentDate);
            const schDateKey = schDate.toISOString().split('T')[0];
            const matchingPeriod = scheduleDates.find(d => d.toISOString().split('T')[0] === schDateKey);
            console.log(`${i + 1}. ${schDateKey} (${sch.percentage * 100}%) - ${matchingPeriod ? '✓ MATCHED' : '✗ NOT MATCHED'}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugVSCROSchedule();
