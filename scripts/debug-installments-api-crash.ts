
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Testing Installments API Logic...');
    try {
        const userId = 'user_2jg8UCOg4J3F38d8d8d8'; // Approximate or fetch real one if needed, but the script can just query all or find first.
        // Actually, let's just find any plan to test the logic, or all plans.

        const plans = await prisma.barbosaInstallmentPlan.findMany({
            include: {
                category: true,
                transactions: {
                    select: {
                        id: true,
                        date: true,
                        amount: true,
                        status: true,
                        isStatistical: true,
                        comprobante: true,
                        description: true // IMPORTANT: Need to select this to test the crash!
                    },
                    orderBy: { date: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${plans.length} plans.`);

        const enhancedPlans = plans.map(p => {
            const paidTx = p.transactions.filter(t => t.status === 'REAL');

            // The logic I added:
            let maxQuota = 0;
            paidTx.forEach(t => {
                // POTENTIAL CRASH HERE if description is missing
                if (!t.description) {
                    console.warn(`Transaction ${t.id} has NO description!`);
                    return;
                }
                const match = t.description.match(/Cuota\s*(\d+)\//i);
                if (match) {
                    const q = parseInt(match[1]);
                    if (q > maxQuota) maxQuota = q;
                }
            });

            const paidCount = maxQuota > paidTx.length ? maxQuota : paidTx.length;

            return {
                id: p.id,
                paidCount
            };
        });

        console.log('Processed successfully:', enhancedPlans.length);

    } catch (e) {
        console.error('CRASHED:', e);
    }
}

main();
