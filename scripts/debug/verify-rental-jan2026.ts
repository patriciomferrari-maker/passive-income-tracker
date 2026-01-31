
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔎 Verifying Jan 2026 Cashflows...');

    // Find cashflows for Jan 2026
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-02-01T00:00:00Z');

    const cashflows = await prisma.rentalCashflow.findMany({
        where: {
            date: { gte: start, lte: end }
        },
        include: { contract: true }
    });

    console.log(`Found ${cashflows.length} cashflows for Jan 2026.`);

    for (const cf of cashflows) {
        console.log(`Contract: ${cf.contract.id} | Amount: ${(cf.amountARS || 0).toFixed(2)} | IPC Monthly: ${(cf.ipcMonthly || 0) * 100}% | IPC Accum: ${(cf.ipcAccumulated || 0) * 100}%`);

        // We expect IPC Monthly to be roughly 3.0% (0.03) for Jan 2026 if it was applied.
        // Or if it's an adjustment month, IPC Accum might be higher.
        // But ipcMonthly field should reflect the monthly IPC if captured (generating logic sets it).
    }
}

main().finally(async () => await prisma.$disconnect());
