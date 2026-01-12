import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = (await prisma.user.findFirst())?.id;
    if (!userId) return;

    // Find Min/Max dates
    const minDate = await prisma.barbosaTransaction.findFirst({ orderBy: { date: 'asc' } });
    const maxDate = await prisma.barbosaTransaction.findFirst({ orderBy: { date: 'desc' } });

    console.log('Earliest Transaction:', minDate?.date);
    console.log('Latest Transaction:', maxDate?.date);

    const txs = await prisma.barbosaTransaction.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        include: { category: true }
    });

    console.log('Sample Recent Txs:');
    txs.forEach(t => {
        console.log(`- ${t.date.toISOString().slice(0, 10)}: ${t.amount} ${t.currency} (Rate: ${t.exchangeRate})`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
