
import { prisma } from '@/lib/prisma';

async function main() {
    const users = await prisma.user.findMany({
        include: {
            properties: {
                select: { id: true, name: true, gasId: true, electricityId: true, municipalId: true }
            }
        }
    });

    console.log('Users found:', users.length);
    users.forEach(u => {
        console.log(`- ${u.email} (${u.id})`);
        console.log(`  Properties: ${u.properties.length}`);
        u.properties.forEach(p => {
            const services = [];
            if (p.gasId) services.push('Gas');
            if (p.electricityId) services.push('Electricity');
            if (p.municipalId) services.push('ABL');
            console.log(`    - ${p.name}: ${services.join(', ') || 'No services'}`);
        });
    });
}

main().finally(() => prisma.$disconnect());
