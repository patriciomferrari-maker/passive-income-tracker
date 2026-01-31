
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getDashboardStats } = require('../app/lib/dashboard-data');
const { isSameMonth } = require('date-fns');

// Mock next/server/auth related imports if needed (dashboard-data doesn't use them directly mostly)
// dashboard-data uses prisma.

async function main() {
    const email = 'patriciomferrari@gmail.com';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return console.log('User not found');

    console.log(`Checking stats for ${user.email} (${user.id})`);

    // We can't easily import getDashboardStats because it imports '@/lib/prisma' with alias
    // BETTER: Just replicate the PF logic here with raw prisma call.

    const bankOperations = await prisma.bankOperation.findMany({
        where: { userId: user.id, type: 'PLAZO_FIJO' },
    });

    console.log('Found operations:', bankOperations.length);

    const today = new Date();
    const now = new Date();

    bankOperations.forEach(op => {
        if (!op.startDate) return;

        console.log('\n--- Operation ---');
        console.log('Alias:', op.alias);
        console.log('StartDate (DB):', op.startDate.toISOString());
        console.log('Duration:', op.durationDays);

        const start = new Date(op.startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + (op.durationDays || 30));

        console.log('Calculated End (Raw):', end.toISOString());

        // Previous Logic (that caused 1/2)
        // format(end) -> ?

        // Current Logic (with +4h)
        const adjustedDate = new Date(end.getTime() + (4 * 60 * 60 * 1000));
        console.log('Adjusted End (+4h):', adjustedDate.toISOString());

        const inMonth = isSameMonth(adjustedDate, now);
        console.log(`Is Same Month (${now.toISOString()})?`, inMonth);
    });

}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
