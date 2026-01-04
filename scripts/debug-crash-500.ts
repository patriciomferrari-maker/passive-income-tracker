
import { prisma } from '@/lib/prisma';

async function main() {
    console.log('Starting reproduction of 500 error...');
    const userId = 'cm4qg6h7j0000v8f9z8m1q5l2'; // Arbitrary user ID or fetch one

    try {
        // simulate the logic in the route
        const investment = await prisma.investment.findFirst({
            where: { userId, type: 'CRYPTO' }
        });

        if (!investment) {
            console.log('No investment found, skipping transaction creation simulation.');
            return;
        }

        console.log('Attempting to create transaction with notes...');

        // @ts-ignore - simulating the type error in runtime
        const transaction = await prisma.transaction.create({
            data: {
                investmentId: investment.id,
                type: 'BUY',
                quantity: 1,
                price: 100,
                commission: 0,
                totalAmount: -100,
                currency: 'USD',
                date: new Date(),
                notes: 'Test Note' // This should fail if field doesn't exist
            }
        });
        console.log('Transaction created:', transaction);

    } catch (error) {
        console.error('CAUGHT ERROR:', error);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
