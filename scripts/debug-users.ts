
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            _count: {
                select: { investments: true }
            }
        }
    });

    console.log('Users found:', users.length);
    for (const u of users) {
        console.log(`User: ${u.email} (${u.id}) - Investments: ${u._count.investments}`);
    }

    const cedears = await prisma.investment.findMany({
        where: { type: 'CEDEAR' },
        select: { ticker: true, userId: true }
    });
    console.log(`Total CEDEARs in DB: ${cedears.length}`);
    if (cedears.length > 0) {
        console.log('Sample CEDEARs:', cedears.slice(0, 5));
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
