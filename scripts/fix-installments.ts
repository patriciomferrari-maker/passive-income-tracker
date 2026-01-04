
import { prisma } from '../lib/prisma'; // Adjusted path for scripts folder

async function main() {
    console.log('Finding duplicates in Installment Plans...');

    // Fetch all plans with transactions count
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        include: {
            _count: {
                select: { transactions: true }
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    // Group by key: description (lower) + totalAmount
    const groups = new Map<string, typeof plans>();

    for (const p of plans) {
        // Normalize Key: Remove whitespace, lowercase
        const key = `${p.description.trim().toLowerCase()}-${p.totalAmount}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)?.push(p);
    }

    console.log(`Found ${plans.length} total plans.`);
    console.log(`Found ${groups.size} unique keys.`);

    let deletedCount = 0;

    for (const [key, group] of groups) {
        if (group.length > 1) {
            console.log(`\nDuplicate Group: "${key}" (${group.length} items)`);

            // Strategy:
            // 1. Prefer ones with transactions.
            // 2. If multiple have transactions, keep the LATEST one? Or the EARLIEST?
            //    Usually duplicates are accidental re-entries later. But maybe the latest one is the "corrected" one?
            //    Or maybe the user wants to keep the one that is actually active?
            //    Let's look at the data.

            // Sort by transaction count (desc), then by createdAt (desc)
            // We assume the one with transactions is the "Real" one.
            // If both have transactions, we might have a problem (double entry).

            const sorted = group.sort((a, b) => {
                if (b._count.transactions !== a._count.transactions) {
                    return b._count.transactions - a._count.transactions;
                }
                // If same transactions, assume the latest one is the one we touched last?
                // Or maybe the first one is the original?
                // Let's keep the NEWEST one if counts are equal, assuming it might be an edit that created a copy?
                return b.createdAt.getTime() - a.createdAt.getTime();
            });

            const winner = sorted[0];
            const losers = sorted.slice(1);

            console.log(`  Keeping: ${winner.id} (${winner._count.transactions} txs) - ${winner.description} ($${winner.totalAmount})`);

            for (const loser of losers) {
                console.log(`  DELETING: ${loser.id} (${loser._count.transactions} txs) - Created: ${loser.createdAt.toISOString()}`);

                // Perform deletion
                await prisma.barbosaInstallmentPlan.delete({
                    where: { id: loser.id }
                });
                deletedCount++;
            }
        }
    }

    console.log(`\nDeleted ${deletedCount} duplicate plans.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
