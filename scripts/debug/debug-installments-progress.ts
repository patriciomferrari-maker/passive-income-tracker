
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Inspecting Installment Plan Descriptions...');
    try {
        const plans = await prisma.barbosaInstallmentPlan.findMany({
            include: {
                transactions: {
                    select: {
                        id: true,
                        date: true,
                        description: true,
                        status: true
                    },
                    orderBy: { date: 'asc' }
                }
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        plans.forEach(p => {
            console.log(`Plan: ${p.description} (${p.installmentsCount} quotas)`);
            const paid = p.transactions.filter(t => t.status === 'REAL');
            paid.forEach(t => {
                console.log(`   - Tx [${t.status}]: "${t.description}"`);
                const match = t.description?.match(/Cuota\s*(\d+)\//i);
                console.log(`     -> Match: ${match ? match[1] : 'NO MATCH'}`);
            });
            console.log('---------------------------------------------------');
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
