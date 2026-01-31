
import { prisma } from '@/lib/prisma';

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'patriciomferrari@gmail.com' }
    });
    console.log('User ID:', user?.id);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
