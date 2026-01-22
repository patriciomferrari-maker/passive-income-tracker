
import { prisma } from '../lib/prisma';

async function main() {
    const users = await prisma.user.findMany();
    console.log('Users found:', users.map(u => ({ id: u.id, email: u.email, name: u.name })));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
