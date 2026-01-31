
import { prisma } from '../lib/prisma';

async function main() {
    try {
        const properties = await prisma.property.findMany({
            where: { municipalId: { not: null } },
            select: { municipalId: true, name: true }
        });
        console.log('Found properties with ABL IDs:');
        console.log(JSON.stringify(properties, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
