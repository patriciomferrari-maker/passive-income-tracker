import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const plan = await prisma.barbosaInstallmentPlan.findFirst({
        where: { description: { contains: 'Portsaid', mode: 'insensitive' } },
        include: { transactions: true }
    });
    console.log(JSON.stringify(plan, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
