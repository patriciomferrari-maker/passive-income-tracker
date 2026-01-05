
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateTransactionSchema = z.object({
  type: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  commission: z.number().min(0).optional(),
  date: z.string(),
  notes: z.string().optional()
});

async function main() {
  console.log('Starting reproduction of 500 error...');
  const userId = 'cm4qg6h7j0000v8f9z8m1q5l2'; // Retrieved User ID
  const ticker = 'BTC'; 
  const validationPayload = {
      type: 'BUY',
      quantity: 0.1,
      price: 50000,
      commission: 0,
      date: new Date().toISOString(),
      notes: 'Test Note from Script'
  };

  try {
      console.log('Validating payload...');
      const validatedData = CreateTransactionSchema.parse(validationPayload);
      console.log('Payload valid.');

      // 1. Find or Create Investment
      let investment = await prisma.investment.findFirst({
        where: { userId, type: 'CRYPTO', ticker }
      });

      if (!investment) {
        console.log('Creating new investment...');
        investment = await prisma.investment.create({
            data: {
                userId,
                ticker,
                name: 'Bitcoin', // Hardcoded for test
                type: 'CRYPTO',
                market: 'CRYPTO',
                lastPrice: validatedData.price
            }
        });
      }
      console.log('Investment ID:', investment.id);

      console.log('Attempting to create transaction with notes...');
      
      const totalAmount = validatedData.quantity * validatedData.price + (validatedData.commission || 0);

      const transaction = await prisma.transaction.create({
          data: {
              investmentId: investment.id,
              type: validatedData.type,
              quantity: validatedData.quantity,
              price: validatedData.price,
              commission: validatedData.commission || 0,
              totalAmount: validatedData.type === 'BUY' ? totalAmount : -totalAmount,
              currency: 'USD',
              date: new Date(validatedData.date),
              notes: validatedData.notes // THIS IS THE CHECK
          }
      });
      console.log('Transaction created successfully:', transaction.id);

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
