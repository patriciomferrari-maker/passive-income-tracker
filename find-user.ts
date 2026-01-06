import { prisma } from './lib/prisma';

async function findUser() {
    const user = await prisma.user.findFirst();
    if (user) {
        console.log('FOUND_USER_ID:', user.id);
    } else {
        console.log('NO_USER_FOUND');
    }
    process.exit(0);
}

findUser();
