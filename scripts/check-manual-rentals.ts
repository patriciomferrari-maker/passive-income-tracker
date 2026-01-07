
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkManualRentals() {
    const userId = 'cmixpqcnk00003mnmljva12cg';


    // List all categories
    const categories = await prisma.barbosaCategory.findMany({
        where: { userId }
    });

    console.log('Categories found:', categories.map(c => c.name).join(', '));

}

checkManualRentals()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
