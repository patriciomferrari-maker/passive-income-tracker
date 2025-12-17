
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const userId = 'user_2pg2V84yPq8y1tM2J8p8y1tM2J8'; // Assuming a user ID or fetching first user

async function main() {
    console.log("Starting Debug...");
    const users = await prisma.user.findMany({
        include: { _count: { select: { barbosaTransactions: true } } }
    });

    console.log("Users found:", users.length);
    users.forEach(u => console.log(` - ${u.email} (${u.id}): ${u._count.barbosaTransactions} txs`));

    const targetUser = users.find(u => u._count.barbosaTransactions > 0);
    if (!targetUser) {
        console.log("No user with transactions found.");
        return;
    }

    const userId = targetUser.id;
    console.log("analyzing User:", userId);

    const today = new Date(); // Dec 17 2025
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    console.log('Range:', startDate.toISOString(), 'to', endDate.toISOString());

    const txs = await prisma.barbosaTransaction.findMany({
        where: { userId }, // Fetch ALL to see what's up, then filter in memory if needed to test range match
        include: { category: true }
    });

    console.log(`Found ${txs.length} total transactions for user`);

    const monthlyData: any = {};

    // Init months
    let current = new Date(startDate);
    while (current <= endDate) {
        const y = current.getFullYear();
        const m = current.getMonth();
        const key = `${y}-${(m + 1).toString().padStart(2, '0')}`;
        // console.log('Init key:', key);
        monthlyData[key] = {
            date: new Date(y, m, 1)
        };
        current.setMonth(current.getMonth() + 1);
    }

    console.log("Keys initialized:", Object.keys(monthlyData));

    txs.forEach(tx => {
        // Range check (mimic database filter)
        if (tx.date < startDate || tx.date > endDate) {
            console.log(`Skipping Date ${tx.date.toISOString()} (Out of range)`);
            return;
        }

        const key = `${tx.date.getFullYear()}-${(tx.date.getMonth() + 1).toString().padStart(2, '0')}`;
        console.log(`Probe Tx: ${tx.date.toISOString()} -> Key: ${key}`);

        if (!monthlyData[key]) {
            console.error(`FAIL: Key ${key} not in monthlyData!`);
            // This mimics what would happen in the API without the safety check
        } else {
            console.log("MATCH OK");
        }
    });

    console.log("Debug Completed");
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
