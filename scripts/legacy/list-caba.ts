
import { prisma } from '../lib/prisma';

async function listCaba() {
    const props = await prisma.property.findMany({
        where: { jurisdiction: 'CABA', municipalId: { not: null } }
    });
    console.log('--- CABA Properties ---');
    props.forEach(p => console.log(`- ${p.name}: ${p.municipalId}`));
}

listCaba().catch(e => console.error(e));
